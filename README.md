# 키미 코드

QR·바코드·읽기·검증·비밀번호 도구 모음. 향후 주소는 **https://code.kyminfo.com**입니다.

## 현재 상태 — 2026-10-12

**2026-10-12 GitHub·Cloudflare Pages 배포 완료.** 저장소 `gym720-dot/kyminfo-code`, Pages 프로젝트 `kyminfo-code`. 사용자 DNS 등록 완료, HTTPS 활성화 최종 확인 진행 중입니다. 5개 키미 사이트의 명칭과 Family Sites를 통일했습니다. 구글·네이버 등록·광고 연결은 추후 진행합니다.

### 제공 기능

1. URL QR: http/https 주소 정규화, 실행 URI·자격증명 포함 주소 차단
2. 와이파이 QR: WPA/WPA2 개인용·WEP·개방형, 숨김 SSID, 특수 문자 처리
3. 텍스트 QR: 한글·이모지·줄바꿈, UTF-8 바이트 한도
4. 명함 QR: vCard 3.0, UTF-8 줄 접기, VCF 저장
5. 이메일 QR: mailto, 제목·본문 URL 인코딩
6. 전화 QR: tel, 국제번호 입력
7. QR 이미지 읽기: PNG·JPEG·WebP, 로컬 Worker 해독, 자동 링크 이동 없음
8. 바코드: CODE128·EAN13·EAN8·UPC-A·ITF14·CODE39, PNG·SVG
9. 체크디지트: GS1 계열 4개 번호의 계산·검증, 선행 0 유지
10. 비밀번호: Web Crypto, 문자 선택 편향 방지, 그룹별 최소 포함, 기본 가림

QR 공통: PNG·SVG, 목표 256/512/1024px, 실제 정수 모듈 크기, 사방 4모듈 여백, L/M/Q/H, 진한 3색과 흰 배경. 인쇄 제목·40/50/70mm·1장/4장 배치. 입력이 바뀌면 이전 결과를 무효화합니다.

지원하지 않는 기능: 동적 QR 변경·리디렉션·조회 통계, 중앙 로고, 카메라, 여러 QR 동시 해독, GS1-128, 상품번호 발급, WPA3 전용/802.1X, 자동 연락처 등록. 정적 QR은 암호화가 아닙니다.

## 실행

Node.js 24, pnpm 11.25.0. 프로젝트 경로에서 실행합니다.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

개발: http://127.0.0.1:5185/

```powershell
pnpm test
pnpm build
pnpm preview
```

빌드 미리보기: http://127.0.0.1:4185/ (프로세스를 종료하거나 컴퓨터를 다시 시작하면 다시 실행해야 합니다.)

텍스트는 별도 폴더 `../kyminfo-textlab`에서 `pnpm preview`, http://127.0.0.1:4184/ 입니다. 두 프로젝트는 각각 독립적으로 빌드됩니다.

## 검증

- `pnpm test`: 37개 자동 검증. SVG를 이미지로 렌더링하고 생성기와 별도의 jsQR/ZXing 해독기로 원문 일치 확인.
- `pnpm build`: TypeScript, Vite, 17개 정적 HTML/16개 사이트맵 URL, 내부 링크·메타·구조화 데이터·CSP·광고 비활성 검사.
- 브라우저에서 실제 저장한 25개 PNG/SVG/VCF를 `tests/verify-downloads.mjs`로 읽어 원문 비교.
- 합성 PNG/JPEG/WebP QR, 일반 이미지, HTML 형태 데이터, 잘못된 파일, 과대 이미지 검사.
- 390px 전체 도구, 320/768/1920px 홈·긴 바코드 레이아웃 확인.

자세한 결과와 한계: `review/QA-2026-10-12.md`. 실제 휴대전화·물리 스캐너·프린터 시험은 이 로컬 검증에 포함되지 않습니다.

테스트 자료 재생성: `node tests/create-fixtures.mjs`. sharp/Resvg/ZXing/pngjs는 검증용 개발 의존성이며 사이트 번들에 포함되지 않습니다. 다운로드 검증 명령: `node tests/verify-downloads.mjs review/download-manifest.json` (해당 로컬 파일이 있는 경우).

## 파일 구조

- `scripts/content.mjs`: 도구·고유 설명·FAQ·공식 참고 자료·향후 도메인
- `scripts/generate.mjs`: 정적 HTML·사이트맵·robots·CSP·라이선스
- `src/engine.ts`: QR payload·렌더링·바코드·체크디지트·비밀번호
- `src/image-info.ts`: 디코딩 전에 이미지 해상도·형식 검사
- `src/worker.ts`, `src/reader-worker.ts`: 작업 분리와 시간 제한
- `src/app.ts`: 접근 가능한 입력·결과·저장·초기화·인쇄
- `src/styles.css`: 기존 키미 사이트와 공통 K 로고·1200px 정렬·카드·Family Sites

## 개인정보 및 광고

가입·DB·외부 API·CDN·분석·광고 요청 없음. 입력·선택 이미지·생성 비밀번호를 localStorage/IndexedDB/쿠키에 저장하지 않습니다. 페이지 이탈·복원 시 입력을 초기화합니다. 저장 파일과 클립보드의 관리는 사용자의 기기에서 이루어집니다. 브라우저/운영체제 메모리의 완전 소거를 보장하지는 않습니다.

광고 후보 위치는 HTML 주석으로만 남깁니다. 향후 연결 시 승인 상태·개인정보/동의 고지·CSP 허용 목록·반응형 크기·레이아웃 이동·도구 조작 영역과의 간격을 다시 검토해야 합니다. 실행 버튼·다운로드 버튼과 혼동되는 광고 배치는 하지 않습니다.

검색 등록·배포·광고 단계는 [두 사이트 후속 작업 목록](../text-code-next-steps.md)을 따릅니다. 현재 `public/robots.txt`·`public/sitemap.xml`은 향후 도메인 기준 준비 파일입니다. 제출한 상태가 아닙니다. pages.dev 공개/미리보기 주소에는 noindex 헤더를 준비했습니다.
