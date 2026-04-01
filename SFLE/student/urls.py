from django.urls import path
from . import views

app_name = 'student'

urlpatterns = [
    path('profile/', views.get_profile, name='profile'),
    path('dashboard/', views.get_dashboard, name='dashboard'),
    path('themes/', views.get_themes, name='themes'),
    path('themes/<int:theme_id>/', views.get_theme_detail, name='theme_detail'),
    path('themes/<int:theme_id>/test/', views.get_test, name='get_test'),
    path('themes/<int:theme_id>/test/submit/', views.submit_test, name='submit_test'),
    path('progress/', views.get_progress, name='progress'),
    path('self-study/', views.get_self_study, name='self_study'),
]