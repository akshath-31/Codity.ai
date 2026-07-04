-- Add organization_id to workers
ALTER TABLE workers ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Create RLS policy for queues
CREATE POLICY "Users can access queues in their organization"
ON queues FOR ALL TO authenticated
USING (
    project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- Create RLS policy for jobs
CREATE POLICY "Users can access jobs in their organization"
ON jobs FOR ALL TO authenticated
USING (
    queue_id IN (
        SELECT id FROM queues WHERE project_id IN (
            SELECT id FROM projects WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    )
);

-- Create RLS policy for workers
CREATE POLICY "Users can access workers in their organization"
ON workers FOR ALL TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);
