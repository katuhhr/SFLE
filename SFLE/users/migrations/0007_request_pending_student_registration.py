
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_user_teaching_groups_fk_user_table'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    ALTER TABLE request ALTER COLUMN user_id DROP NOT NULL;

                    ALTER TABLE request ADD COLUMN IF NOT EXISTS pending_email VARCHAR(254) NULL;
                    ALTER TABLE request ADD COLUMN IF NOT EXISTS pending_password VARCHAR(200) NOT NULL DEFAULT '';
                    ALTER TABLE request ADD COLUMN IF NOT EXISTS pending_firstname VARCHAR(100) NOT NULL DEFAULT '';
                    ALTER TABLE request ADD COLUMN IF NOT EXISTS pending_lastname VARCHAR(100) NOT NULL DEFAULT '';

                    DO $x$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'request'
                          AND column_name = 'pending_group_id'
                      ) THEN
                        ALTER TABLE request
                          ADD COLUMN pending_group_id INTEGER NULL
                          REFERENCES "group"(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
                      END IF;
                    END
                    $x$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='Request',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                        ('type', models.CharField(max_length=100, verbose_name='Тип заявки')),
                        (
                            'pending_email',
                            models.EmailField(blank=True, max_length=254, null=True, verbose_name='Email заявки'),
                        ),
                        (
                            'pending_password',
                            models.CharField(blank=True, max_length=200, verbose_name='Пароль (хэш)'),
                        ),
                        (
                            'pending_firstname',
                            models.CharField(blank=True, max_length=100, verbose_name='Имя (заявка)'),
                        ),
                        (
                            'pending_lastname',
                            models.CharField(blank=True, max_length=100, verbose_name='Фамилия (заявка)'),
                        ),
                        (
                            'pending_group',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='+',
                                to='users.group',
                                verbose_name='Группа (заявка)',
                            ),
                        ),
                        (
                            'user',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='requests',
                                to='users.user',
                                verbose_name='Пользователь',
                            ),
                        ),
                    ],
                    options={
                        'db_table': 'request',
                        'verbose_name': 'Заявка',
                        'verbose_name_plural': 'Заявки',
                    },
                ),
            ],
        ),
    ]
