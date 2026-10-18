# dos music player
도스에서 감상하던 adlib 또는 트래커 음악을 웹으로 감상하는 플레이어

## 기능
- 도스박물관 **QuickBASIC** (gcjjyy@gmail.com) 님의 **IMS Player**를 참고하여 제작
- 서버 모듈없이 브라우저 자체 처리(HTML,Javascript,WASM) 만으로 클론 제작이 목표
- 조합형코드 처리
- 재생목록
  - 더블클릭으로 재생
  - 음악제목 추출을 위한 다양한 해더 파싱정보 추가
  - 음악제목에 여러공백 허용
- 재생
  - 일시정지
  - 음소거
- ISS 가사(되도록 DOS와 유사하게 구성)
  - 2줄 출력 (현재가사, 다음가사)
  - 여러공백 허용
  - 좌측정렬
  - 폰트 크기 조절로 줄바꿈 없이 출력
  - 현재가사 세로 긴폰트 표현
  - 가로가 좁으면 가사창을 위로 올림.
  - 가사가 없으면 해더정보 출력(일부)
- 재생바 클릭시 해당 시점으로 이동
  - 기능이 되는 것일뿐, 상용은 하지 말자!
  - 대부분의 모듈이 건너뛰는 시간이 오래걸림.

## 설치
```bash
git clone https://github.com/Hyunee7/dos music player
```

웹 서버의 경로 설정만 하면 그 상태로 사용 가능.

## 제작 참고
- QuickBASIC (gcjjyy@gmail.com) 님의 IMS Player 를 참고 하였습니다.
  - Site https://github.com/gcjjyy/imsplay
  - GitHub https://github.com/gcjjyy/imsplay

- AdPlug https://github.com/adplug/adplug
- libopenmpt https://github.com/openmpt/openmpt


## 라이선스
MIT 라이선스 (https://choosealicense.com/ko/licenses/mit/)