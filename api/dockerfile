FROM alpine

RUN echo "@testing http://nl.alpinelinux.org/alpine/edge/testing" >>/etc/apk/repositories

RUN apk add --update --no-cache build-base linux-headers git cmake bash
RUN apk add --update --no-cache zlib zlib-dev bzip2 bzip2-dev snappy snappy-dev lz4 lz4-dev zstd@testing zstd-dev@testing jemalloc jemalloc-dev libtbb-dev@testing libtbb@testing
RUN apk add --update --no-cache python3 python3-dev
RUN pip3 install --upgrade pip setuptools

# installing latest gflags
RUN cd /tmp && \
    git clone https://github.com/gflags/gflags.git && \
    cd gflags && \
    mkdir build && \
    cd build && \
    cmake -DBUILD_SHARED_LIBS=1 -DGFLAGS_INSTALL_SHARED_LIBS=1 .. && \
    make install && \
    cd /tmp && \
    rm -R /tmp/gflags/

# Install Rocksdb
RUN cd /tmp && \
    git clone https://github.com/facebook/rocksdb.git && \
    cd rocksdb && \
    git checkout v4.13 && \
    make shared_lib && \
    mkdir -p /usr/local/rocksdb/lib && \
    mkdir /usr/local/rocksdb/include && \
    cp librocksdb.so* /usr/local/rocksdb/lib && \
    cp /usr/local/rocksdb/lib/librocksdb.so* /usr/lib/ && \
    cp -r include /usr/local/rocksdb/ && \
    cp -r include/* /usr/include/ && \
    rm -R /tmp/rocksdb/

WORKDIR /code
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY api.ini ./
COPY api.py ./
COPY wsgi.py ./

VOLUME ["/run/api", "/var/e2e"]

CMD ["uwsgi", "--ini","api.ini"]
