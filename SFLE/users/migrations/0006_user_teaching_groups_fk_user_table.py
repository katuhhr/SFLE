"""
Исправление FK: user_teaching_groups.user_id должен ссылаться на таблицу "user",
а не на legacy "users" (модель User с Meta.db_table = 'user').
"""
from django.db import migrations


def fix_fk_to_user_table(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DO $body$
            DECLARE
              r RECORD;
            BEGIN
              FOR r IN
                SELECT c.conname AS cname
                FROM pg_constraint c
                JOIN pg_class tbl ON c.conrelid = tbl.oid
                JOIN pg_namespace ns ON tbl.relnamespace = ns.oid
                JOIN pg_class ref ON c.confrelid = ref.oid
                WHERE ns.nspname = current_schema()
                  AND tbl.relname = 'user_teaching_groups'
                  AND c.contype = 'f'
                  AND ref.relname = 'users'
              LOOP
                EXECUTE format('ALTER TABLE user_teaching_groups DROP CONSTRAINT %I', r.cname);
              END LOOP;
            END
            $body$;
            """
        )
        cursor.execute(
            """
            DO $body$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class tbl ON c.conrelid = tbl.oid
                JOIN pg_namespace ns ON tbl.relnamespace = ns.oid
                JOIN pg_class ref ON c.confrelid = ref.oid
                WHERE ns.nspname = current_schema()
                  AND tbl.relname = 'user_teaching_groups'
                  AND c.contype = 'f'
                  AND ref.relname = 'user'
              ) THEN
                ALTER TABLE user_teaching_groups
                  ADD CONSTRAINT user_teaching_groups_user_id_fk_user_table
                  FOREIGN KEY (user_id) REFERENCES "user"(id)
                  ON DELETE CASCADE
                  DEFERRABLE INITIALLY DEFERRED;
              END IF;
            END
            $body$;
            """
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_user_teaching_group'),
    ]

    operations = [
        migrations.RunPython(fix_fk_to_user_table, noop_reverse),
    ]
