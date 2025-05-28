#include <WiFi.h> 
#include <WebSocketsClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Keypad.h>
#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>  
#include <DHT.h>

// ---------- WiFi ----------
const char *ssid = "FPT Telecom-0F80";
const char *password = "Thienkim38783979";

//---------- WebSocket ----------
const char* websocket_host = "192.168.1.11";
const uint16_t websocket_port = 3000;
const char* websocket_path = "/";
WebSocketsClient webSocket;
bool isWebSocketConnected = false;  // Biến theo dõi trạng thái kết nối WebSocket

// ---------- DHT11 ----------
#define DHTPIN 46         // GPIO46 của ESP32-S3
#define DHTTYPE DHT11     // Loại cảm biến DHT11
DHT dht(DHTPIN, DHTTYPE);

// ---------- LCD ----------
LiquidCrystal_I2C lcd(0x27, 16, 2);  // Địa chỉ I2C: 0x27

// ---------- RFID ----------
#define SS_PIN    15
#define SCK_PIN   16
#define MOSI_PIN  17
#define MISO_PIN  18
#define RST_PIN   19
MFRC522 rfid(SS_PIN, RST_PIN);
bool addRFID = false;
bool deleteRFID = false;

// ---------- Keypad ----------
#define ROW_NUM 4
#define COL_NUM 4
char keys[ROW_NUM][COL_NUM] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
}; 
byte pin_rows[ROW_NUM] = {35, 36, 37, 38}; 
byte pin_column[COL_NUM] = {39, 40 ,41 , 42}; 
Keypad keypad = Keypad(makeKeymap(keys), pin_rows, pin_column, ROW_NUM, COL_NUM);

// ---------- Servo ----------
#define SERVO_PIN 21
Servo doorServo;
bool doorOpen = false;
// ---------- Quạt ----------
#define FAN_1_PIN 48
#define FAN_2_PIN 47
bool fanStates[2] = {false, false};
// ---------- LED ----------
#define LED_1_PIN 12 
#define LED_2_PIN 11 
#define LED_3_PIN 10
#define LED_4_PIN 13
#define LED_5_PIN 5
#define LED_6_PIN 6
#define LED_7_PIN 7
bool ledStates[7] = {false, false, false, false, false, false, false};
const int ledPins[7] = {LED_1_PIN, LED_2_PIN, LED_3_PIN, LED_4_PIN, LED_5_PIN, LED_6_PIN, LED_7_PIN};

// ---------- SR602 Motion Sensor ----------
#define SR602_PIN 45
bool lastMotionState = false;

// ---------- MQ-5 Gas Sensor ----------
#define MQ5_PIN 14
#define BUZZER_PIN 4
int GAS_THRESHOLD = 0;
bool lastGasState = false;

// ---------- Timer ----------
unsigned long doorOpenTime = 0;
bool doorTimerActive = false;

unsigned long lastReadTime = 0;          // Thời điểm lần đọc trước
const unsigned long readInterval = 5000; // Thời gian giữa 2 lần đọc (ms)

// ---------- Gửi trạng thái tất cả thiết bị ----------
void sendAllStates() {
  if (webSocket.isConnected()) {
    for (int i = 0; i < 7; i++) { 
      String message = ledStates[i] ? ("LED_" + String(i + 1) + "_ON") : ("LED_" + String(i + 1) + "_OFF"); 
      webSocket.sendTXT(message);                                
      Serial.printf("Gửi đến WebSocket: %s\n", message.c_str()); 
    }
    for (int i = 0; i < 2; i++) { 
     String fanMessage = fanStates[i] ? ("FAN_" + String(i + 1) + "_ON") : ("FAN_" + String(i + 1) + "_OFF");
     webSocket.sendTXT(fanMessage);
     Serial.printf("Gửi đến WebSocket: %s\n", fanMessage.c_str());
    }
    String doorMessage = doorOpen ? "DOOR_OPEN" : "DOOR_CLOSE"; 
    webSocket.sendTXT(doorMessage);                             
    Serial.printf("Gửi đến WebSocket: %s\n", doorMessage.c_str()); 
  }
}

//---------- WebSocket Events ----------
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket ngắt kết nối");
      isWebSocketConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket đã kết nối");
      isWebSocketConnected = true;
      webSocket.sendTXT("ESP32-S3"); // Gửi xác nhận danh tính ESP32-S3
      sendAllStates(); // Gửi trạng thái của các thiết bị
      break;
    case WStype_TEXT: {
      String message = String((char*)payload);
      Serial.printf("Nhận từ WebSocket: %s\n", message.c_str());

      // Xử lý bật/tắt LED
      for (int i = 0; i < 7; i++) {
        String ledOnCmd = "LED_" + String(i + 1) + "_ON";
        String ledOffCmd = "LED_" + String(i + 1) + "_OFF";

        if (message == ledOnCmd) {
          if (!ledStates[i]) {
            ledStates[i] = true;
            digitalWrite(ledPins[i], LOW); // LOW để bật đèn
            Serial.printf("✅ Bật %s từ server\n", ledOnCmd.c_str());
          }
        } else if (message == ledOffCmd) {
          // Không cho tắt LED_5 nếu cửa đang mở
          if (i == 4 && doorOpen) {
            Serial.println("⚠️ Không tắt LED_5 khi cửa đang mở");
            continue;
          }
          if (ledStates[i]) {
            ledStates[i] = false;
            digitalWrite(ledPins[i], HIGH); // HIGH để tắt đèn
            Serial.printf("✅ Tắt %s từ server\n", ledOffCmd.c_str());
          }
        }
      }

      // Xử lý bật/tắt quạt
      for (int i = 0; i < 2; i++) {
        String fanOnCmd = "FAN_" + String(i + 1) + "_ON";
        String fanOffCmd = "FAN_" + String(i + 1) + "_OFF";
        // Xử lý lệnh mở/đóng quạt
          if (message == fanOnCmd) {
        if (!fanStates[i]) {
         fanStates[i] = true;
         digitalWrite(i == 0 ? FAN_1_PIN : FAN_2_PIN, LOW); // LOW để bật quạt
         Serial.printf("✅ Bật %s từ server\n", fanOnCmd.c_str());      
        }
         } else if (message == fanOffCmd) {
        if (fanStates[i]) {
         fanStates[i] = false;
         digitalWrite(i == 0 ? FAN_1_PIN : FAN_2_PIN, HIGH); // HIGH để tắt quạt
         Serial.printf("✅ Tắt %s từ server\n", fanOffCmd.c_str());
          }
         }
      }

      // Xử lý đóng/mở cửa
      if (message == "DOOR_OPEN") {
        if (!doorOpen) {
          updateDoorState(true);
          doorOpenTime = millis();
          doorTimerActive = true;
          Serial.println("✅ Cửa được mở từ server");
        }
      } else if (message == "DOOR_CLOSE") {
        if (doorOpen) {
          updateDoorState(false);
          doorTimerActive = false;
          Serial.println("✅ Cửa được đóng từ server");
        }
      }

      //Trường hợp RFID đúng => Cửa mở
      else if (message.startsWith("RFID_OK")) { // Nếu RFID được gán tên, Server sẽ gửi RFID_OK_X với X là tên
        updateDoorState(true);                  // Nếu RFID không được gán tên, Server sẽ gửi RFID_OK        
        doorOpenTime = millis();
        doorTimerActive = true;

        String name = message.substring(8);  
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Access Granted");
        lcd.setCursor(0, 1);
        lcd.print("Welcome! " + name);
        Serial.printf("✅ Mở cửa - RFID xác minh thành công, tên: %s\n", name.c_str());
      } 
      //Trường hợp mật khẩu đúng => Cửa mở
      else if ( message == "PASSWORD_OK") {
        updateDoorState(true);
        doorOpenTime = millis();
        doorTimerActive = true;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Access Granted");
        lcd.setCursor(0, 1);
        lcd.print("Welcome!");
        Serial.println("✅ Mở cửa - Xác minh thành công");
      }

      //Trường hợp RFID và mật khẩu không đúng => Cửa không mở
      else if (message == "RFID_FAIL" || message == "PASSWORD_FAIL") {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Access Denied");
        lcd.setCursor(0, 1);
        lcd.print("Try Again");
        Serial.println("❌ Từ chối mở cửa - Xác minh thất bại");
      }

      //Trường hợp mật khẩu đúng => Quét RFID để thêm/xóa
      else if(message == "CONFIRM_ADD_RFID_OK"){
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Please!");
        lcd.setCursor(0, 1);
        lcd.print("Scan RFID");
        Serial.println("Xác minh mật khẩu thành công - Quét RFID để thêm");
        addRFID = true;
      }
      else if(message == "CONFIRM_DELETE_RFID_OK"){
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Please!");
        lcd.setCursor(0, 1);
        lcd.print("Scan RFID");
        Serial.println("Xác minh mật khẩu thành công - Quét RFID để xóa");
        deleteRFID = true;
      }

      //Trường hợp mật khẩu không đúng => Không thể quét RFID để thêm/xóa
      else if(message == "CONFIRM_ADD_RFID_FAIL" || message == "CONFIRM_DELETE_RFID_FAIL"){
         lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("PIN Wrong");
        lcd.setCursor(0, 1);
        lcd.print("Try Again");
        Serial.println("Xác minh mật khẩu thất bại - Thử lại");
      }

      //Trường hợp thêm RFID thành công
      else if (message == "ADD_RFID_OK") {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("RFID Added");
      }

      //Trường hợp RFID muốn thêm đã tồn tại trong Database
      else if (message == "ADD_RFID_EXISTS") {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("RFID Exists");
      }

      //Trường hợp xóa RFID thành công
      else if (message == "DELETE_RFID_OK") {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("RFID Deleted");
      }

      //Trường hợp RFID muốn xóa không tìm thấy trong Database
      else if (message == "DELETE_RFID_NOT_FOUND") {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("RFID");
      lcd.setCursor(0, 1);
      lcd.print("Not Found");
      }
      break; 
    }
    default:
      break;
  }
}

// ---------- Cập nhật trạng thái cửa ----------
void updateDoorState(bool newState) {
  if (newState != doorOpen) {
    doorOpen = newState;
    doorServo.write(doorOpen ? 90 : 0);
    Serial.printf("✅ Servo %s cửa\n", doorOpen ? "mở" : "đóng");
    if (doorOpen) {
      ledStates[4] = true;  // LED 5 bật khi cửa mở
      digitalWrite(ledPins[4], LOW);
    }
    if (webSocket.isConnected()) {
      String doorMessage = doorOpen ? "DOOR_OPEN" : "DOOR_CLOSE";
      webSocket.sendTXT(doorMessage);
      Serial.printf("Gửi đến WebSocket: %s\n", doorMessage.c_str());
    if (doorOpen) {
        webSocket.sendTXT("LED_5_ON");
        Serial.println("Gửi đến WebSocket: LED_5_ON");
      }
    }
  }
}
void setup() {
  Serial.begin(115200);
  
  // Khởi tạo DHT
  dht.begin();

  //Khởi tạo LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("   SMART HOME");
  lcd.setCursor(0, 1);
  lcd.print("   BY GROUP 10");

  // Khởi tạo LED
  for (int i = 0; i < 7; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], HIGH);  // Tắt LED (HIGH vì logic ngược)
  }
   // Khởi tạo quạt 
  pinMode(FAN_1_PIN, OUTPUT);
  pinMode(FAN_2_PIN, OUTPUT);
  digitalWrite(FAN_1_PIN, HIGH);  // Tắt quạt ngay từ đầu (logic ngược)
  digitalWrite(FAN_2_PIN, HIGH);  // Tắt quạt ngay từ đầu (logic ngược)

  // Khởi tạo SR602
  pinMode(SR602_PIN, INPUT);
  Serial.println("✅ SR602 Motion Sensor sẵn sàng");

  // Khởi tạo còi và MQ-5
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);  // Tắt còi ban đầu
  pinMode(MQ5_PIN, INPUT);
  Serial.println("✅ MQ-5 Gas Sensor và Buzzer sẵn sàng");

  // Do lần đầu tiên và nhân vs 1.5 để ra ngưỡng
  Serial.println("📏 Đang đo ngưỡng MQ-5...");
  delay(5000);  // Chờ 5 giây để MQ-5 ổn định
  GAS_THRESHOLD = analogRead(MQ5_PIN);
  GAS_THRESHOLD = GAS_THRESHOLD * 2;
  Serial.printf("✅ GAS_THRESHOLD: %d\n", GAS_THRESHOLD);

  // Khởi tạo servo
  doorServo.setPeriodHertz(50);
  doorServo.attach(SERVO_PIN, 500, 2400);
  doorServo.write(0);

  // Khởi tạo RFID
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  rfid.PCD_Init();
  Serial.println("✅ RFID sẵn sàng");

  // Khởi tạo Keypad
  Serial.println("✅ Keypad sẵn sàng");

  //Kết nối WiFi
  WiFi.begin(ssid, password);
  Serial.print("Kết nối WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi đã kết nối");
  while (WiFi.localIP().toString() == "0.0.0.0") {
  delay(100);
  }
  Serial.println(WiFi.localIP());
  delay(1000);
  //Khởi tạo WebSocket
  webSocket.begin(websocket_host, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  unsigned long currentMillis = millis();

  // 🔁 Đo nhiệt độ/độ ẩm mỗi 5 giây
  if (currentMillis - lastReadTime >= readInterval) {
    lastReadTime = currentMillis;

    // 🔵 Đọc nhiệt độ và độ ẩm từ cảm biến DHT
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();  // Đơn vị: °C

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("❌ Lỗi đọc cảm biến DHT!");
      return; // Không thực hiện nếu dữ liệu không hợp lệ
    }
    if (isWebSocketConnected) {
      // ✅ Tạo chuỗi dữ liệu
      String tempMessage = "TEMP:" + String(temperature, 1);
      String humMessage = "HUM:" + String(humidity, 1);

      webSocket.sendTXT(tempMessage);
      webSocket.sendTXT(humMessage);
      Serial.printf("Gửi đến WebSocket: Nhiệt độ: %s, Độ ẩm: %s\n",
       tempMessage.c_str(), humMessage.c_str());

      // 🔁 Kiểm tra điều kiện bật/tắt quạt 1 (ví dụ < 30°C thì bật)
      bool fan1ShouldBeOn = temperature < 30.0;
      if (fan1ShouldBeOn != fanStates[0]) {  // Trạng thái thay đổi
        fanStates[0] = fan1ShouldBeOn;
         digitalWrite(FAN_1_PIN, fan1ShouldBeOn ? LOW : HIGH);  // LOW = bật (logic ngược)

        Serial.printf("✅ FAN_1: %s (Nhiệt độ: %.1f°C)\n",
                      fan1ShouldBeOn ? "Bật" : "Tắt", temperature);
        // Gửi trạng thái quạt lên WebSocket
        String fanMessage = fan1ShouldBeOn ? "FAN_1_ON" : "FAN_1_OFF";
        webSocket.sendTXT(fanMessage);
        Serial.printf("Gửi đến WebSocket: %s\n", fanMessage.c_str());

      }
    }
  }
    
// Xử lý SR602 Motion Sensor
if (isWebSocketConnected) {
  bool motionDetected = digitalRead(SR602_PIN) == HIGH;
  if (motionDetected != lastMotionState) {
    lastMotionState = motionDetected;
    ledStates[3] = motionDetected;  // LED 4 liên kết với SR602
    digitalWrite(LED_4_PIN, motionDetected ? LOW : HIGH);
    Serial.printf("✅ SR602: %s LED 4\n", motionDetected ? "Bật" : "Tắt");

    if (webSocket.isConnected()) {
      String message = motionDetected ? "LED_4_ON" : "LED_4_OFF";
      webSocket.sendTXT(message);
      Serial.printf("Gửi đến WebSocket: %s\n", message.c_str());
    }
  }
}

// Xử lý MQ-5 Gas Sensor
int gasValue = analogRead(MQ5_PIN);
bool gasDetected = gasValue > GAS_THRESHOLD;
if (gasDetected != lastGasState) {
  lastGasState = gasDetected;
  // Điều khiển còi
  digitalWrite(BUZZER_PIN, gasDetected ? LOW : HIGH);  
  // Điều khiển quạt
  Serial.printf("✅ MQ-5: %s Buzzer (Gas Value: %d, Threshold: %d)\n", 
                gasDetected ? "Bật" : "Tắt", gasValue, GAS_THRESHOLD);
  if (webSocket.isConnected()) {
        String message = gasDetected ? "BUZZ_ON" : "BUZZ_OFF";
        webSocket.sendTXT(message);
        Serial.printf("Gửi đến WebSocket: %s\n", message.c_str());
      }
}

// --- Xử lý RFID ---
if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
  // Lấy UID và in ra serial
  String uidStr = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfid.uid.uidByte[i], HEX);
    Serial.print("0x");
    Serial.print(rfid.uid.uidByte[i], HEX);
    Serial.print(" ");
  }
  uidStr.toUpperCase();  // Viết hoa toàn bộ UID
  Serial.println();

  if (webSocket.isConnected()) {
    if (addRFID) {
      String addCmd = "ADD_RFID_" + uidStr;
      webSocket.sendTXT(addCmd);
      Serial.printf("Thêm RFID: %s\n", addCmd.c_str());
      addRFID = false;
    } else if (deleteRFID) {
      String deleteCmd = "DELETE_RFID_" + uidStr;
      webSocket.sendTXT(deleteCmd);
      Serial.printf("Xóa RFID: %s\n", deleteCmd.c_str());
      deleteRFID = false;
    } else {
      String verifyCmd = "VERIFY_RFID_" + uidStr;
      webSocket.sendTXT(verifyCmd);
      Serial.printf("Gửi xác minh RFID: %s\n", verifyCmd.c_str());
    }
  } else {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Waiting for WS...");

    if (webSocket.isConnected()) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WS Connected");
      lcd.setCursor(0, 1);
      lcd.print("Try Again");
    }
  }
  rfid.PICC_HaltA();
}


// --- Xử lý Keypad ---
char key = keypad.getKey();
if (key) {
  Serial.print("Phím nhấn: ");
  Serial.println(key);

  static String inputPIN = "";
  if (key == 'A') {  // ✅ Xác nhận
    if (inputPIN.length() > 0) {
      if (webSocket.isConnected()) {
        String verifyCmd = "VERIFY_PASSWORD_" + inputPIN;
        webSocket.sendTXT(verifyCmd);
        Serial.printf("Gửi xác minh PIN: %s\n", verifyCmd.c_str());
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Waiting for WS...");
      }
      inputPIN = "";
    }

  } else if (key == 'B') {  // ✅ Xóa nhập
    inputPIN = "";
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Input Cleared");
  } else if (key == 'C') {  // ✅ Thêm RFID
    if (inputPIN.length() > 0) {
      if (webSocket.isConnected()) {
        String confirmCmd = "CONFIRM_ADD_RFID_" + inputPIN;
        webSocket.sendTXT(confirmCmd);
        Serial.printf("Gửi xác minh thêm RFID: %s\n", confirmCmd.c_str());
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Waiting for WS...");
      }
      inputPIN = "";
    }
  } else if (key == 'D') {  // ✅ Xóa RFID
    if (inputPIN.length() > 0) {
      if (webSocket.isConnected()) {
        String confirmCmd = "CONFIRM_DELETE_RFID_" + inputPIN;
        webSocket.sendTXT(confirmCmd);
        Serial.printf("Gửi xác minh xóa RFID: %s\n", confirmCmd.c_str());
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Waiting for WS...");
      }
      inputPIN = "";
    }
  } else if (key >= '0' && key <= '9') {  // ✅ Nhập số PIN
    if (inputPIN.length() < 6) {
      inputPIN += key;
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("PIN: ");
      for (size_t i = 0; i < inputPIN.length(); i++) {
        lcd.print("*");
      }
    } else {
      lcd.setCursor(0, 1);
      lcd.print("Password Full");
    }
  }
}

  // Tự động đóng cửa sau 5 giây
  if (doorTimerActive && millis() - doorOpenTime >= 5000) {
    Serial.println("⏰ Đã hết 5 giây, đóng cửa");
    updateDoorState(false);
    doorTimerActive = false;
    lcd.clear();
    lcd.setCursor(0, 0); 
    lcd.print("Door Closed");
  }
}