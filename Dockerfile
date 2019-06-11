FROM amazonlinux:2

WORKDIR /tmp
#install the dependencies
RUN yum -y install gcc-c++ && yum -y install findutils

RUN yum -y install tar gzip

RUN touch ~/.bashrc && chmod +x ~/.bashrc

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash

RUN source ~/.bashrc && nvm install 10.16.0

WORKDIR /build