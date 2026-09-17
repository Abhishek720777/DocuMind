from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterViewTests(TestCase):
    def test_register_success(self):
        """A valid registration returns 201 and a success message."""
        response = self.client.post(
            reverse('register'),
            data={"username": "alice", "password": "securepass123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("message", response.json())
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_register_duplicate_username(self):
        """Registering an existing username returns 400."""
        User.objects.create_user(username="alice", password="pass1234")
        response = self.client.post(
            reverse('register'),
            data={"username": "alice", "password": "anotherpass"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_register_missing_fields(self):
        """Omitting username or password returns 400."""
        response = self.client.post(
            reverse('register'),
            data={"username": ""},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_register_short_password(self):
        """Password shorter than 8 characters returns 400."""
        response = self.client.post(
            reverse('register'),
            data={"username": "bob", "password": "short"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("8 characters", response.json()["error"])


class LoginViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="charlie", password="validpass123"
        )

    def test_login_success_sets_cookie(self):
        """A successful login returns 200 and sets the access_token cookie."""
        response = self.client.post(
            reverse('login'),
            data={"username": "charlie", "password": "validpass123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

    def test_login_invalid_credentials(self):
        """Wrong password returns 401."""
        response = self.client.post(
            reverse('login'),
            data={"username": "charlie", "password": "wrongpass"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_login_nonexistent_user(self):
        """Logging in with an unknown username returns 401."""
        response = self.client.post(
            reverse('login'),
            data={"username": "nobody", "password": "pass1234"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)


class LogoutViewTests(TestCase):
    def test_logout_clears_cookies(self):
        """Logout should return 200 and clear auth cookies."""
        response = self.client.post(reverse('logout'))
        self.assertEqual(response.status_code, 200)
        # After logout, cookies should be deleted (set to empty / max-age=0)
        self.assertIn("access_token", response.cookies)
