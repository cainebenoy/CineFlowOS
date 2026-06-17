package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

var s3Client *s3.Client
var presignClient *s3.PresignClient
var bucketName = "cineflow-vfx"

// Initialize S3 client with MinIO configurations or R2 credentials
func init() {
	endpoint := os.Getenv("R2_ENDPOINT_URL")
	if endpoint == "" {
		endpoint = "http://localhost:9000"
	}
	
	accessKey := os.Getenv("R2_ACCESS_KEY_ID")
	if accessKey == "" {
		accessKey = "local_admin"
	}
	
	secretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	if secretKey == "" {
		secretKey = "localpassword"
	}

	envBucket := os.Getenv("R2_BUCKET_NAME")
	if envBucket != "" {
		bucketName = envBucket
	}

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("us-east-1"), // Required by SDK, ignored by MinIO/R2
		config.WithCredentialsProvider(aws.CredentialsProviderFunc(func(ctx context.Context) (aws.Credentials, error) {
			return aws.Credentials{
				AccessKeyID:     accessKey,
				SecretAccessKey: secretKey,
				Source:          "EnvironmentOrMinIO",
			}, nil
		})),
	)
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	// Override the endpoint
	s3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true // CRITICAL for MinIO and R2 compatibility
	})
	
	presignClient = s3.NewPresignClient(s3Client)
	
	// Create bucket if it doesn't exist
	go func() {
		time.Sleep(5 * time.Second)
		_, err := s3Client.CreateBucket(context.TODO(), &s3.CreateBucketInput{
			Bucket: aws.String(bucketName),
		})
		if err != nil {
			log.Printf("Bucket %s might already exist or storage is unreachable: %v", bucketName, err)
		} else {
			log.Printf("Successfully created bucket %s", bucketName)
		}
	}()
}

// GetVFXShots retrieves all VFX shots and their associated assets
func GetVFXShots(db *database.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "id")
		
		// Query to fetch shots
		rows, err := db.Pool.Query(context.Background(), `
			SELECT id, scene_id, take_id, shot_code, status, vendor_assigned, created_at
			FROM vfx_shots WHERE project_id = $1
			ORDER BY shot_code ASC
		`, projectID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		shots := []map[string]interface{}{}
		for rows.Next() {
			var id, sceneID, takeID uuid.UUID
			var shotCode, status, vendorAssigned *string
			var createdAt time.Time
			
			if err := rows.Scan(&id, &sceneID, &takeID, &shotCode, &status, &vendorAssigned, &createdAt); err != nil {
				continue
			}
			
			// Get assets for this shot
			assetRows, _ := db.Pool.Query(context.Background(), `
				SELECT id, asset_type, file_url, uploaded_by, notes, created_at
				FROM vfx_assets WHERE vfx_shot_id = $1
				ORDER BY created_at DESC
			`, id)
			
			assets := []map[string]interface{}{}
			for assetRows.Next() {
				var aId, uploadedBy uuid.UUID
				var aType, aUrl, notes *string
				var aCreated time.Time
				assetRows.Scan(&aId, &aType, &aUrl, &uploadedBy, &notes, &aCreated)
				assets = append(assets, map[string]interface{}{
					"id": aId,
					"asset_type": aType,
					"file_url": aUrl,
					"uploaded_by": uploadedBy,
					"notes": notes,
					"created_at": aCreated,
				})
			}
			assetRows.Close()

			shots = append(shots, map[string]interface{}{
				"id": id,
				"scene_id": sceneID,
				"take_id": takeID,
				"shot_code": shotCode,
				"status": status,
				"vendor_assigned": vendorAssigned,
				"created_at": createdAt,
				"assets": assets,
			})
		}
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(shots)
	}
}

// GeneratePresignedURL generates a 15-minute PutObject URL directly to MinIO/S3
func GeneratePresignedURL() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Filename    string `json:"filename"`
			ContentType string `json:"content_type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Ensure unique object key
		objectKey := fmt.Sprintf("%s-%s", uuid.New().String(), req.Filename)

		presignedReq, err := presignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
			Bucket:      aws.String(bucketName),
			Key:         aws.String(objectKey),
			ContentType: aws.String(req.ContentType),
		}, s3.WithPresignExpires(15*time.Minute))
		
		if err != nil {
			http.Error(w, "Could not generate presigned URL", http.StatusInternalServerError)
			return
		}

		// The URL Next.js will upload to
		uploadURL := presignedReq.URL
		
		// The URL Next.js will save in the database after successful upload
		endpoint := os.Getenv("R2_ENDPOINT_URL")
		if endpoint == "" {
			endpoint = "http://localhost:9000"
		}
		fileURL := fmt.Sprintf("%s/%s/%s", endpoint, bucketName, objectKey)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"upload_url": uploadURL,
			"file_url":   fileURL,
		})
	}
}

// LogVFXAsset writes the uploaded asset metadata to PostgreSQL
func LogVFXAsset(db *database.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			VFXShotID string `json:"vfx_shot_id"`
			AssetType string `json:"asset_type"`
			FileURL   string `json:"file_url"`
			Notes     string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		var newID uuid.UUID
		err := db.Pool.QueryRow(context.Background(), `
			INSERT INTO vfx_assets (vfx_shot_id, asset_type, file_url, notes)
			VALUES ($1, $2, $3, $4) RETURNING id;
		`, req.VFXShotID, req.AssetType, req.FileURL, req.Notes).Scan(&newID)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"id": newID.String()})
	}
}

// CreateVFXShot manually adds a new shot to the tracker
func CreateVFXShot(db *database.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "id")
		
		var req struct {
			SceneID  string `json:"scene_id"`
			ShotCode string `json:"shot_code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		var newID uuid.UUID
		err := db.Pool.QueryRow(context.Background(), `
			INSERT INTO vfx_shots (project_id, scene_id, shot_code)
			VALUES ($1, $2, $3) RETURNING id;
		`, projectID, req.SceneID, req.ShotCode).Scan(&newID)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"id": newID.String()})
	}
}
