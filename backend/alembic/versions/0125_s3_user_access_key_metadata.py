# Copyright (c) 2026 Laurent Barbe
# Licensed under the Apache License, Version 2.0

"""Persist labels for S3 user access keys.

Revision ID: 0125_s3_user_access_key_metadata
Revises: 0124_canonical_manager_usage_scopes
Create Date: 2026-09-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0125_s3_user_access_key_metadata"
down_revision = "0124_canonical_manager_usage_scopes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "s3_user_access_key_metadata",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("s3_user_id", sa.Integer(), nullable=False),
        sa.Column("access_key_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "TRIM(access_key_id) <> ''",
            name="ck_s3_user_access_key_metadata_key_nonempty",
        ),
        sa.CheckConstraint(
            "TRIM(name) <> '' AND LENGTH(name) <= 128",
            name="ck_s3_user_access_key_metadata_name",
        ),
        sa.CheckConstraint(
            "description IS NULL OR LENGTH(description) <= 500",
            name="ck_s3_user_access_key_metadata_description",
        ),
        sa.ForeignKeyConstraint(
            ["s3_user_id"],
            ["s3_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "s3_user_id",
            "access_key_id",
            name="uq_s3_user_access_key_metadata_user_key",
        ),
    )
    op.create_index(
        "ix_s3_user_access_key_metadata_user",
        "s3_user_access_key_metadata",
        ["s3_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_s3_user_access_key_metadata_user",
        table_name="s3_user_access_key_metadata",
    )
    op.drop_table("s3_user_access_key_metadata")
