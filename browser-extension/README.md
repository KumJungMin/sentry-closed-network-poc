# Sentry 폐쇄망 한국어 도우미

Self-hosted Sentry 자체를 포크하지 않고, 운영자가 보는 고정 UI 문구만 브라우저에서 한국어로 바꾸는 오프라인 Chrome 확장입니다. 이벤트 제목, 태그, 사용자 입력, 코드, 스택 트레이스는 번역하지 않습니다.

## 설치

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. 이 저장소의 `browser-extension` 폴더를 선택합니다.
5. `http://localhost:9000` 또는 `http://127.0.0.1:9000`의 Sentry 탭을 새로고침합니다.

확장은 위 두 로컬 주소에서만 실행되며 네트워크 요청, 저장소, 클립보드 권한이 없습니다. 번역을 늘리려면 `dictionary.js`에 영문 원문과 한국어 문구를 정확히 일치하는 쌍으로 추가한 뒤 확장 관리 화면에서 새로고침합니다.

## 검증

```bash
node --test browser-extension/translator-core.test.mjs
```
