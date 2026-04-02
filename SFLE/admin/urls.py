from django.urls import path
from . import views

app_name = 'admin_api'

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
]