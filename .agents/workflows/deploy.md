---
description: Lightsail 서버에 AdMaker 배포하기
---
// turbo-all

# AdMaker Lightsail 배포 워크플로우

## 1단계: Lightsail 인스턴스 생성 (AWS 콘솔에서)
1. https://lightsail.aws.amazon.com 접속
2. "인스턴스 생성" 클릭
3. 리전: **도쿄 (ap-northeast-1)** 선택
4. 플랫폼: **Linux/Unix**
5. 블루프린트: **OS Only → Ubuntu 22.04 LTS**
6. 인스턴스 플랜: **$5/월 (1GB RAM)** 추천
7. 이름: `AdMaker-Server`
8. "인스턴스 생성" 클릭

## 2단계: 고정 IP 할당 (AWS 콘솔에서)
1. 생성된 인스턴스 클릭
2. "네트워킹" 탭 → "고정 IP 생성" 클릭
3. 할당된 IP 주소 기록 (예: 13.xxx.xxx.xxx)

## 3단계: 방화벽 설정 (AWS 콘솔에서)
1. 인스턴스 → "네트워킹" 탭
2. "규칙 추가" 클릭:
   - **HTTP (80)** 추가
   - **HTTPS (443)** 추가
   - **사용자 지정 TCP 3000** 추가

## 4단계: 서버 접속 및 초기 세팅
인스턴스 페이지에서 "SSH를 사용하여 연결" 클릭 후, 아래 명령어를 **순서대로** 붙여넣기:

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 20 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 설치 (프로세스 관리자)
sudo npm install -g pm2

# Nginx 설치 (리버스 프록시)
sudo apt install -y nginx

# Git은 이미 설치되어 있음, 확인
git --version
```

## 5단계: 코드 배포
```bash
# 홈 디렉토리에 코드 다운로드
cd ~
git clone https://github.com/xsid1970/AdMaker4.0.git
cd AdMaker4.0

# 의존성 설치
npm install

# uploads 폴더 생성 (사용자 파일용)
mkdir -p uploads

# PM2로 서버 실행
pm2 start server.js --name admaker
pm2 save
pm2 startup
```

## 6단계: Nginx 리버스 프록시 설정
```bash
sudo nano /etc/nginx/sites-available/admaker
```
아래 내용 붙여넣기 (Ctrl+Shift+V):
```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
저장: Ctrl+O → Enter → Ctrl+X

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/admaker /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 🔄 업데이트 및 동기화 방법 (필독 ⭐)

이제 데이터베이스가 **템플릿 전용(`templates.db`)**과 **직원 작업용(`ad_system.db`)**으로 분리되었습니다.

### 옵션 A: 코드만 업데이트 (가장 빠름)
디자인(HTML/CSS/JS)이나 서버 기능만 수정했을 때 사용합니다.
1. 로컬에서 `git push`
2. 서버 SSH 접속 후: `cd ~/AdMaker4.0 && git pull && pm2 restart admaker`

### 옵션 B: 템플릿 및 이미지 동기화 (권장 ⭐)
새로운 템플릿을 만들었거나 이미지를 추가했을 때 사용합니다. **직원들의 작업 내역을 건드리지 않고 안전하게 배포할 수 있습니다.**
1. 로컬 PowerShell에서 실행:
```powershell
# 템플릿 DB 전송 (노트북의 최신 템플릿을 서버로)
scp -i "$HOME\Downloads\LightsailDefaultKey-ap-northeast-2.pem" "C:\Users\xsid1\Desktop\AdMaker4.0\templates.db" ubuntu@13.125.184.180:~/AdMaker4.0/templates.db

# 이미지 파일 전송 (로컬에만 있는 새 이미지들을 서버로)
scp -i "$HOME\Downloads\LightsailDefaultKey-ap-northeast-2.pem" C:\Users\xsid1\Desktop\AdMaker4.0\uploads\* ubuntu@13.125.184.180:~/AdMaker4.0/uploads/
```
2. 서버 SSH 접속 후: `pm2 restart admaker`

### 옵션 C: 전체 동기화 (주의 ⚠️)
회원 정보나 관리자 설정까지 통째로 노트북 상태로 되돌리고 싶을 때만 사용합니다.
**주의: 서버에만 저장된 직원들의 최신 작업 내역(ad_system.db)이 삭제될 수 있습니다.**
1. 로컬 PowerShell에서 실행:
```powershell
scp -i "$HOME\Downloads\LightsailDefaultKey-ap-northeast-2.pem" "C:\Users\xsid1\Desktop\AdMaker4.0\ad_system.db" ubuntu@13.125.184.180:~/AdMaker4.0/ad_system.db
```
2. 서버 SSH 접속 후: `pm2 restart admaker`

---

## 7단계: 접속 테스트
브라우저에서 `http://13.125.184.180` 접속 → AdMaker 로그인 화면이 나오면 성공!

---

## 🔄 업데이트 배포 (코드 수정 후)

### 노트북에서:
```powershell
cd C:\Users\xsid1\Desktop\AdMaker4.0
git add .
git commit -m "기능 개선 설명"
git push
```

### 서버에서 (SSH 접속 후):
```bash
cd ~/AdMaker4.0
git pull
pm2 restart admaker
```
