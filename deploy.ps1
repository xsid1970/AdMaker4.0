# AdMaker 4.0 One-Click Deployment Script (PowerShell)

$IP = "13.125.184.180"
$LOCAL_DIR = "C:\Users\xsid1\Desktop\AdMaker4.0"
$KEY_PATH = "$LOCAL_DIR\LightsailDefaultKey-ap-northeast-2.pem"
$REMOTE_USER = "ubuntu"
$REMOTE_PATH = "~/AdMaker4.0"

$CommitMsg = $args[0]
if (-not $CommitMsg) {
    $CommitMsg = "🚀 자동 배포 및 업데이트: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host "--- 🟢 배포 프로세스 시작 ($CommitMsg) ---" -ForegroundColor Cyan

# 1. 로컬 코드 푸시 (Git)
Write-Host "`n1. Git 코드를 Github으로 푸시 중..." -ForegroundColor Yellow
git add .
try {
    git commit -m "$CommitMsg"
    git push
} catch {
    Write-Host "⚠️ 변경 사항이 없거나 커밋 실패 (무시하고 진행)" -ForegroundColor Gray
}

# 2. 데이터베이스 및 리소스 동기화 (SCP)
Write-Host "`n2. 템플릿 DB 및 업로드 파일을 서버로 전송 중..." -ForegroundColor Yellow
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "$LOCAL_DIR\templates.db" "${REMOTE_USER}@${IP}:${REMOTE_PATH}/templates.db"
# 이미지 폴더 전송 (로컬에 있는 이미지들만 전송)
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no -r "$LOCAL_DIR\uploads\*" "${REMOTE_USER}@${IP}:${REMOTE_PATH}/uploads/"

# 3. 서버 코드 업데이트 및 재시작 (SSH)
Write-Host "`n3. 서버 코드 풀(git pull) 및 PM2 재시작..." -ForegroundColor Yellow
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "${REMOTE_USER}@${IP}" "cd $REMOTE_PATH && git pull && pm2 restart admaker"

Write-Host "`n--- ✅ 모든 배포 작업이 성공적으로 완료되었습니다! ---" -ForegroundColor Green
Write-Host "접속 주소: http://$IP" -ForegroundColor Cyan
