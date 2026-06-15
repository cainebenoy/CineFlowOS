package database

import (
	"context"
	"fmt"
)

// InitSchema creates the foundational tables if they do not exist.
func (db *DB) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title VARCHAR(255) NOT NULL,
		project_type VARCHAR(50) NOT NULL,
		status VARCHAR(50) DEFAULT 'active',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS scenes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		scene_number VARCHAR(10) NOT NULL,
		setting VARCHAR(10),
		time_of_day VARCHAR(50),
		page_eighths INT,
		summary TEXT
	);

	CREATE TABLE IF NOT EXISTS breakdown_elements (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		category VARCHAR(50) NOT NULL,
		name VARCHAR(255) NOT NULL
	);

	CREATE TABLE IF NOT EXISTS scene_elements (
		scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
		element_id UUID REFERENCES breakdown_elements(id) ON DELETE CASCADE,
		PRIMARY KEY (scene_id, element_id)
	);

	CREATE TABLE IF NOT EXISTS shoot_days (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		day_number INT NOT NULL,
		shoot_date DATE,
		status VARCHAR(50) DEFAULT 'draft'
	);

	CREATE TABLE IF NOT EXISTS scheduled_scenes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		shoot_day_id UUID REFERENCES shoot_days(id) ON DELETE SET NULL,
		scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
		sort_order INT NOT NULL,
		estimated_minutes INT DEFAULT 0
	);
	`

	_, err := db.Pool.Exec(context.Background(), schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %v", err)
	}

	fmt.Println("Database schema initialized successfully.")
	return nil
}