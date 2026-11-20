BEGIN;

CREATE TABLE IF NOT EXISTS exam_generation_requests (
    id UUID PRIMARY KEY,
    matrix_id UUID NOT NULL REFERENCES exam_matrices(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    number_of_papers INTEGER NOT NULL CHECK (number_of_papers > 0),
    CONSTRAINT uq_exam_generation_request UNIQUE (matrix_id, request_id)
);

INSERT INTO exam_generation_requests (id, matrix_id, request_id, number_of_papers)
SELECT gen_random_uuid(), matrix_id, generation_request_id, COUNT(*)::INTEGER
FROM exam_papers
WHERE generation_request_id IS NOT NULL
GROUP BY matrix_id, generation_request_id
ON CONFLICT (matrix_id, request_id) DO NOTHING;

COMMIT;
