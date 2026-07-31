FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# No auto-seed here anymore -- current-state metadata comes from a real
# DataHub instance via refresh.py (run on the host, see deploy.sh), which
# populates this same Mongo before/independently of the backend container
# starting. The container just serves whatever's already there.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
