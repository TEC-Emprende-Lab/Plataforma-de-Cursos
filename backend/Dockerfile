FROM python:3.11.15-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/app \
    PORT=5050

# CairoSVG needs the Cairo shared library. Fontconfig indexes only the font
# files versioned in backend/fonts; the image performs no remote font download.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fontconfig \
        libcairo2 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --create-home --home-dir /home/app app

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY fonts/ /usr/local/share/fonts/custom/
RUN fc-cache --force /usr/local/share/fonts/custom \
    && fc-list | grep -qi "Outfit" \
    && fc-list | grep -qi "Onest"

COPY . ./

USER app

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '5050') + '/api/health', timeout=3).read()"

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
