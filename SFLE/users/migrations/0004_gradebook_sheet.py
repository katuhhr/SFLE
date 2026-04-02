import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_major_short_name'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Group',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                    ],
                    options={
                        'db_table': 'group',
                        'managed': False,
                    },
                ),
                migrations.CreateModel(
                    name='GradebookSheet',
                    fields=[
                        (
                            'group',
                            models.OneToOneField(
                                on_delete=django.db.models.deletion.CASCADE,
                                primary_key=True,
                                related_name='gradebook_sheet',
                                serialize=False,
                                to='users.group',
                                verbose_name='Группа',
                            ),
                        ),
                        (
                            'column_titles',
                            models.JSONField(default=list, verbose_name='Заголовки колонок'),
                        ),
                        (
                            'cells',
                            models.JSONField(
                                default=dict,
                                verbose_name='Ячейки: student_id → список значений',
                            ),
                        ),
                    ],
                    options={
                        'verbose_name': 'Ведомость',
                        'verbose_name_plural': 'Ведомости',
                        'db_table': 'gradebook_sheet',
                    },
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    DO $db$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = 'public'
                              AND table_name = 'gradebook_sheet'
                        ) THEN
                            -- имя могло остаться только как тип без таблицы после сбоя миграции
                            EXECUTE 'DROP TYPE IF EXISTS public.gradebook_sheet CASCADE';
                            CREATE TABLE public.gradebook_sheet (
                                group_id INTEGER NOT NULL PRIMARY KEY
                                    REFERENCES "group"(id) ON DELETE CASCADE,
                                column_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
                                cells JSONB NOT NULL DEFAULT '{}'::jsonb
                            );
                        END IF;
                    END
                    $db$;
                    """,
                    reverse_sql='DROP TABLE IF EXISTS gradebook_sheet;',
                ),
            ],
        ),
    ]
