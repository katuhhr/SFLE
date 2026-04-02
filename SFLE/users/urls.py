from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/groups/', views.register_group_options, name='auth_register_groups'),
    path('register/', views.register, name='auth_register'),
    # JWT login by email
    path('token/', views.EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Current user
    path('me/', views.me, name='auth_me'),
]
