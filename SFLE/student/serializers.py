from rest_framework import serializers
from django.db import connection
from django.db.utils import ProgrammingError
from users.models import (
    User, Theme, Theory, Material, Test, Question, AnswerOption, SelfStudyTheme, Task, Attendance,
)


class MaterialNodeSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(allow_null=True, required=False)

    class Meta:
        model = Material
        fields = ['id', 'title', 'type', 'url', 'description', 'created_at']


class ThemeWithMaterialsSerializer(serializers.ModelSerializer):
    materials = MaterialNodeSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'name', 'materials']


class TheoryLearningTreeSerializer(serializers.ModelSerializer):
    themes = ThemeWithMaterialsSerializer(many=True, read_only=True)

    class Meta:
        model = Theory
        fields = ['id', 'name', 'themes']


class ThemeCatalogSerializer(serializers.ModelSerializer):
    """Тема с материалами для каталога «специальность + курс»."""
    materials = MaterialNodeSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'name', 'materials', 'major_id', 'course_id']


class StudentProfileSerializer(serializers.ModelSerializer):
    """Поля имён — напрямую из колонок БД firstname/lastname (модель: first_name/last_name)."""

    firstname = serializers.SerializerMethodField()
    lastname = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    major_name = serializers.SerializerMethodField()
    course_number = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'firstname',
            'lastname',
            'full_name',
            'email',
            'role',
            'group_name',
            'major_name',
            'course_number',
            'is_active',
        ]

    def get_firstname(self, obj):
        return (getattr(obj, 'first_name', None) or '').strip()

    def get_lastname(self, obj):
        return (getattr(obj, 'last_name', None) or '').strip()

    def get_full_name(self, obj):
        # Регистрация: parts[0] → фамилия (lastname), остальное → имя и отчество (firstname).
        ln = self.get_lastname(obj)
        fn = self.get_firstname(obj)
        return f'{ln} {fn}'.strip()

    def get_group_name(self, obj):
        return obj.group.name if getattr(obj, 'group_id', None) else None

    def get_major_name(self, obj):
        g = getattr(obj, 'group', None)
        if g and getattr(g, 'major', None):
            return g.major.name
        return None

    def get_course_number(self, obj):
        g = getattr(obj, 'group', None)
        if g and getattr(g, 'course', None):
            return g.course.number
        return None


class ThemeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Theme
        fields = ['id', 'name']


class ThemeDetailSerializer(serializers.ModelSerializer):
    theory = serializers.SerializerMethodField()
    links = serializers.SerializerMethodField()
    tasks = serializers.SerializerMethodField()
    
    class Meta:
        model = Theme
        fields = ['id', 'name', 'theory', 'links', 'tasks']
    
    def get_theory(self, obj):
        if obj.theory:
            return {
                'id': obj.theory.id,
                'title': obj.theory.name,
                'content': obj.theory.text
            }
        return None

    def get_links(self, obj):
        if not obj.theory_id:
            return []
        try:
            # In some DB snapshots there is no file/theory_to_file table yet.
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT f.id, f.name, f.storage_url, f.type
                    FROM theory_to_file tf
                    JOIN file f ON f.id = tf.file_id
                    WHERE tf.theory_id = %s
                    ORDER BY f.id
                    """,
                    [obj.theory_id],
                )
                rows = cursor.fetchall()
            return [
                {'id': row[0], 'title': row[1], 'url': row[2], 'type': row[3]}
                for row in rows
            ]
        except ProgrammingError:
            return []

    def get_tasks(self, obj):
        tasks = Task.objects.filter(theme=obj).order_by('deadline_date')
        return [
            {
                'id': t.id,
                'text': t.text,
                'deadline': t.deadline_date,
            }
            for t in tasks
        ]


class QuestionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()
    
    class Meta:
        model = Question
        fields = ['id', 'text', 'text_type', 'options']
    
    def get_options(self, obj):
        return [{'id': opt.id, 'text': opt.text} for opt in obj.answer_options.all()]


class TestSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    
    class Meta:
        model = Test
        fields = ['id', 'number', 'title', 'questions']
    
    def get_title(self, obj):
        return obj.text
    
    def get_questions(self, obj):
        # Получаем вопросы, связанные с этим тестом
        # В твоей модели нужно настроить связь Test -> Question
        # Пока используем связь через theme
        questions = Question.objects.filter(
            id__in=AnswerOption.objects.values_list('question', flat=True).distinct()
        )[:10]
        return QuestionSerializer(questions, many=True).data


class AttendanceSerializer(serializers.ModelSerializer):
    date_str = serializers.DateField(source='date', format='%Y-%m-%d')
    
    class Meta:
        model = Attendance
        fields = ['date_str', 'is_came', 'is_completed']


class TestResultSerializer(serializers.Serializer):
    test_name = serializers.CharField()
    date = serializers.DateField()
    score = serializers.IntegerField()
    max_score = serializers.IntegerField()
    percentage = serializers.FloatField()


class TaskStatusSerializer(serializers.Serializer):
    task_name = serializers.CharField()
    deadline = serializers.DateTimeField()
    status = serializers.CharField()  # 'submitted', 'not_submitted', 'checked'
    grade = serializers.IntegerField(allow_null=True)


class SelfStudySerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='theory.name')
    content = serializers.CharField(source='theory.text')
    
    class Meta:
        model = SelfStudyTheme
        fields = ['id', 'title', 'content']


class ThemeCommonSelfStudySerializer(serializers.ModelSerializer):
    """Общие темы: запись `theme` без специальности и курса; текст из `theory`."""

    title = serializers.CharField(source='name')
    content = serializers.CharField(source='theory.text', allow_blank=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'title', 'content']


class DashboardSerializer(serializers.Serializer):
    current_tasks = serializers.ListField()
    debts = serializers.ListField()