-- Migration 002: contracts хүснэгтэд creator_role багана нэмэх
-- Үүсгэгч худалдагч уу, худалдан авагч уу гэдгийг тэмдэглэх
-- Ажиллуулах: psql -d e_contract -f migrations/002_contracts_creator_role.sql

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS creator_role VARCHAR(10) NOT NULL DEFAULT 'seller'
  CHECK (creator_role IN ('seller', 'buyer'));
