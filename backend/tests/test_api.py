import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_lifeos.db"
os.environ["SECRET_KEY"] = "test-secret-key"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


def auth_headers(client: TestClient):
    response = client.post("/api/auth/register", json={
        "full_name": "Test User", "email": "test@lifeos.example.com", "password": "testing123"
    })
    if response.status_code == 409:
        response = client.post("/api/auth/login", json={"email": "test@lifeos.example.com", "password": "testing123"})
    assert response.status_code == 200 or response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module():
    Base.metadata.drop_all(bind=engine)
    Path("test_lifeos.db").unlink(missing_ok=True)


def test_health_and_crud():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "healthy"
        headers = auth_headers(client)
        created = client.post("/api/tasks", headers=headers, json={"title": "Test LifeOS", "priority": "high"})
        assert created.status_code == 201
        task = created.json()
        assert task["title"] == "Test LifeOS"
        assert client.patch(f"/api/tasks/{task['id']}", headers=headers, json={"status": "done"}).json()["status"] == "done"
        assert client.get("/api/dashboard", headers=headers).json()["task_done"] == 1


def test_assistant_deterministic_agents():
    with TestClient(app) as client:
        headers = auth_headers(client)
        task = client.post("/api/assistant/chat", headers=headers, json={"message": "add task to revise graphs tomorrow at 7 PM"})
        assert task.status_code == 200
        assert task.json()["agent"] == "task-agent"
        music = client.post("/api/assistant/chat", headers=headers, json={"message": "play Blinding Lights"})
        assert music.json()["action"]["type"] == "music_search"
        question = client.post("/api/assistant/chat", headers=headers, json={"message": "How can I stop procrastinating?"})
        assert question.json()["agent"] == "knowledge-agent"
        whatsapp = client.get("/api/integrations/whatsapp/summary", headers=headers)
        assert whatsapp.status_code == 200
        assert whatsapp.json()["count"] == 0
