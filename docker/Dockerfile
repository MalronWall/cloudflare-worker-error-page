FROM python:3.11-slim

WORKDIR /app
COPY check_ip_and_store.py .

RUN pip install requests

ENV PYTHONUNBUFFERED=1

CMD ["python", "check_ip_and_store.py"]