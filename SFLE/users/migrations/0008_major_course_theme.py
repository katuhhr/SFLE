import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_request_pending_student_registration'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Major',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                    ],
                    options={
                        'db_table': 'major',
                        'managed': False,
                    },
                ),
                migrations.CreateModel(
                    name='Course',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                    ],
                    options={
                        'db_table': 'course',
                        'managed': False,
                    },
                ),
                migrations.CreateModel(
                    name='Theme',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                    ],
                    options={
                        'db_table': 'theme',
                        'managed': False,
                    },
                ),
                migrations.CreateModel(
                    name='MajorCourseTheme',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('semester', models.IntegerField(blank=True, null=True, verbose_name='Семестр')),
                        ('order_number', models.IntegerField(blank=True, null=True, verbose_name='Порядок изучения')),
                        ('is_required', models.BooleanField(default=True, verbose_name='Обязательная')),
                        ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                        (
                            'course',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='major_course_theme_links',
                                to='users.course',
                                verbose_name='Курс',
                            ),
                        ),
                        (
                            'major',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='major_course_theme_links',
                                to='users.major',
                                verbose_name='Специальность',
                            ),
                        ),
                        (
                            'theme',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='major_course_links',
                                to='users.theme',
                                verbose_name='Тема',
                            ),
                        ),
                    ],
                    options={
                        'verbose_name': 'Связь специальность–курс–тема',
                        'verbose_name_plural': 'Связи специальность–курс–тема',
                        'db_table': 'major_course_theme',
                    },
                ),
                migrations.AddConstraint(
                    model_name='majorcoursetheme',
                    constraint=models.UniqueConstraint(
                        fields=('major', 'course', 'theme'),
                        name='uniq_major_course_theme_mct',
                    ),
                ),
                migrations.AddIndex(
                    model_name='majorcoursetheme',
                    index=models.Index(fields=['major', 'course'], name='idx_mct_major_course'),
                ),
                migrations.AddIndex(
                    model_name='majorcoursetheme',
                    index=models.Index(fields=['theme'], name='idx_mct_theme'),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    CREATE TABLE IF NOT EXISTS major_course_theme (
                        id SERIAL PRIMARY KEY,
                        major_id INTEGER NOT NULL REFERENCES major(id) ON DELETE CASCADE,
                        course_id INTEGER NOT NULL REFERENCES course(id) ON DELETE CASCADE,
                        theme_id INTEGER NOT NULL REFERENCES theme(id) ON DELETE CASCADE,
                        semester INTEGER,
                        order_number INTEGER,
                        is_required BOOLEAN NOT NULL DEFAULT true,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                        UNIQUE (major_id, course_id, theme_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_mct_major_course
                        ON major_course_theme (major_id, course_id);
                    CREATE INDEX IF NOT EXISTS idx_mct_theme ON major_course_theme (theme_id);
                    """,
                    reverse_sql='DROP TABLE IF EXISTS major_course_theme;',
                ),
            ],
        ),
    ]
