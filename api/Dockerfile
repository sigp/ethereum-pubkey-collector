FROM alpine

RUN apk add --update --no-cache build-base linux-headers cmake bash python3 python3-dev postgresql-dev 
RUN pip3 install --upgrade pip setuptools

WORKDIR /code
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY api.ini ./
COPY api.py ./
COPY wsgi.py ./

CMD ["uwsgi", "--ini","api.ini"]
