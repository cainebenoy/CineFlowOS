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
		scene_number VARCHAR(50) NOT NULL,
		setting VARCHAR(50),
		time_of_day VARCHAR(50),
		page_eighths INT,
		summary TEXT
	);

	CREATE TABLE IF NOT EXISTS breakdown_elements (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		category VARCHAR(50) NOT NULL,
		name VARCHAR(255) NOT NULL,
		estimated_cost DECIMAL(12,2) DEFAULT 0.00,
		actual_cost DECIMAL(12,2) DEFAULT 0.00,
		CONSTRAINT unique_project_element UNIQUE (project_id, category, name)
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
		estimated_minutes INT DEFAULT 0,
		CONSTRAINT unique_scheduled_scene UNIQUE (scene_id)
	);

	DROP TABLE IF EXISTS takes CASCADE;
	CREATE TABLE IF NOT EXISTS takes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
		take_number INT NOT NULL,
		lens VARCHAR(50),
		duration_seconds INT,
		is_circled BOOLEAN DEFAULT FALSE,
		supervisor_notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT unique_scene_take UNIQUE (scene_id, take_number)
	);

	CREATE TABLE IF NOT EXISTS crew_members (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		role VARCHAR(100) NOT NULL,
		phone_number VARCHAR(20) NOT NULL,
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT unique_crew_member UNIQUE (project_id, phone_number)
	);

	INSERT INTO crew_members (project_id, name, role, phone_number) 
	VALUES 
		('85bf2069-e3fe-40e8-8739-8ad1cbeebf87', 'Adhityan', 'Director of Photography', '+919876543210'),
		('85bf2069-e3fe-40e8-8739-8ad1cbeebf87', 'Mohamed', 'Gaffer', '+919876543211'),
		('85bf2069-e3fe-40e8-8739-8ad1cbeebf87', 'Cyril', 'Transport Coordinator', '+919876543212')
	ON CONFLICT (project_id, phone_number) DO NOTHING;

	ALTER TABLE breakdown_elements ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2) DEFAULT 0.00;
	ALTER TABLE breakdown_elements ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(12,2) DEFAULT 0.00;
	`

	_, err := db.Pool.Exec(context.Background(), schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %v", err)
	}

	fmt.Println("Database schema initialized successfully.")
	return nil
}