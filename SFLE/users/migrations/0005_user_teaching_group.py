import django.db.models.deletion
from django.db import migrations, models


def copy_teacher_group_to_m2m(apps, schema_editor):
    UserTeachingGroup = apps.get_model('users', 'UserTeachingGroup')
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, group_id FROM "user"
            WHERE role = 'teacher' AND group_id IS NOT NULL
            """
        )
        for uid, gid in cursor.fetchall():
            UserTeachingGroup.objects.get_or_create(user_id=uid, group_id=gid)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_gradebook_sheet'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserTeachingGroup',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                (
                    'group',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='teacher_assignment_links',
                        to='users.group',
                        verbose_name='Группа',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='teaching_group_links',
                        to='users.user',
                        verbose_name='Преподаватель',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Группа преподавателя',
                'verbose_name_plural': 'Группы преподавателей',
                'db_table': 'user_teaching_groups',
                'unique_together': {('user', 'group')},
            },
        ),
        migrations.RunPython(copy_teacher_group_to_m2m, migrations.RunPython.noop),
    ]
