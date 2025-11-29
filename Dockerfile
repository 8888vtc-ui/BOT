FROM alpine:latest as builder

# Installer les dépendances de compilation
RUN apk add --no-cache \
    build-base \
    clang \
    cmake \
    make \
    autoconf \
    automake \
    libtool \
    pkgconfig \
    gettext-dev \
    python3-dev \
    sqlite-dev \
    zlib-dev \
    ncurses-dev \
    readline-dev \
    bison \
    flex \
    wget \
    tar \
    xz

# Télécharger et extraire GNUBG
WORKDIR /tmp
RUN wget -q https://ftp.gnu.org/gnu/gnubg/gnubg-release-1.07.001-sources.tar.gz && \
    tar xzf gnubg-release-1.07.001-sources.tar.gz && \
    rm gnubg-release-1.07.001-sources.tar.gz

# Compiler avec flags statiques
WORKDIR /tmp/gnubg-release-1.07.001
RUN ./autogen.sh

# Configuration pour compilation statique
RUN ./configure \
    --enable-static \
    --disable-shared \
    --without-gtk \
    --without-board3d \
    --without-python \
    --without-sqlite \
    --disable-cputime \
    --disable-gprof \
    LDFLAGS="-static" \
    CFLAGS="-Os -static" \
    CXXFLAGS="-Os -static" \
    --prefix=/opt/gnubg

# Compiler et installer
RUN make -j$(nproc) && make install

# Stripper le binaire pour réduire la taille
RUN strip /opt/gnubg/bin/gnubg

# Étape finale minimaliste
FROM alpine:latest

COPY --from=builder /opt/gnubg/bin/gnubg /gnubg

# Tester que le binaire fonctionne
RUN /gnubg --version && \
    echo "Binary info:" && \
    file /gnubg && \
    ldd /gnubg 2>/dev/null || echo "Static binary - no dependencies"

CMD ["/gnubg", "--version"]
