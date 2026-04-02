from django.urls import path
from . import views

app_name = 'admin'

urlpatterns = [
    #заявки преподов
    path('applications/', views.get_applications, name='applications'),
    path('applications/<int:app_id>/', views.get_application_detail, name='application_detail'),
    path('applications/<int:app_id>/approve/', views.approve_application, name='approve_application'),
    path('applications/<int:app_id>/reject/', views.reject_application, name='reject_application'),
    
    #преподы
    path('teachers/', views.get_teachers, name='teachers'),
    path('teachers/<int:teacher_id>/', views.get_teacher_detail, name='teacher_detail'),
    path('teachers/<int:teacher_id>/groups/', views.manage_teacher_groups, name='teacher_groups'),
    
    #группы
    path('groups/', views.get_groups, name='groups'),
    path('groups/create/', views.create_group, name='create_group'),

    # Подтверждение регистрации студентов преподавателем
    path('teacher/requests/', views.get_teacher_registration_requests, name='teacher_registration_requests'),
    path('teacher/requests/<int:req_id>/approve/', views.approve_teacher_registration_request, name='approve_teacher_registration_request'),
    path('teacher/requests/<int:req_id>/reject/', views.reject_teacher_registration_request, name='reject_teacher_registration_request'),

    # Расписание (неделя, синхронизация с таблицей schedule)
    path('teacher/schedule/', views.teacher_schedule_week, name='teacher_schedule_week'),
    path('teacher/groups/', views.teacher_group_options, name='teacher_group_options'),

    # Ведомость (оценки по группе)
    path('teacher/gradebook/groups/', views.gradebook_groups, name='gradebook_groups'),
    path('teacher/gradebook/catalog/', views.gradebook_catalog, name='gradebook_catalog'),
    path('teacher/gradebook/', views.gradebook_sheet, name='gradebook_sheet'),

    # Учебные материалы (теория → тема → material); CRUD — только преподаватель
    path('learning/catalog/', views.learning_catalog, name='learning_catalog'),
    path('learning/topics/', views.learning_topics, name='learning_topics'),
    path('learning/tree/', views.learning_tree, name='learning_tree'),
    path('learning/theories/', views.learning_theory_create, name='learning_theory_create'),
    path('learning/theories/<int:pk>/', views.learning_theory_detail, name='learning_theory_detail'),
    path('learning/themes/', views.learning_theme_create, name='learning_theme_create'),
    path('learning/themes/<int:pk>/', views.learning_theme_detail, name='learning_theme_detail'),
    path('learning/materials/', views.learning_material_create, name='learning_material_create'),
    path('learning/materials/<int:pk>/', views.learning_material_detail, name='learning_material_detail'),

    # Самоподготовка (только чтение; наполнение через БД / админку)
    path('teacher/self-study/', views.teacher_self_study, name='teacher_self_study'),
]