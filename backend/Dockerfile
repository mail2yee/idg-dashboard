FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Re-seeds fake data on every start — this is a demo dataset with no real
# user-generated writes, so a fresh consistent dataset on each deploy is the
# desired behavior, not a bug.
CMD ["sh", "-c", "python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
