#include <Arduino.h>

/*
Basic ESP8266 MQTT example

This sketch demonstrates the capabilities of the pubsub library in combination
with the ESP8266 board/library.

It connects to an MQTT server then:
- publishes "hello world" to the topic "outTopic" every two seconds
- subscribes to the topic "inTopic", printing out any messages
it receives. NB - it assumes the received payloads are strings not binary
- If the first character of the topic "inTopic" is an 1, switch ON the ESP Led,
else switch it off

It will reconnect to the server if the connection is lost using a blocking
reconnect function. See the 'mqtt_reconnect_nonblocking' example for how to
achieve the same result without blocking the main loop.

To install the ESP8266 board, (using Arduino 1.6.4+):
- Add the following 3rd party board manager under "File -> Preferences -> Additional Boards Manager URLs":
http://arduino.esp8266.com/stable/package_esp8266com_index.json
- Open the "Tools -> Board -> Board Manager" and click install for the ESP8266"
- Select your ESP8266 in "Tools -> Board"

*/

#include <ESP8266WiFi.h>
#include <PubSubClient.h>

#include "NetworkSettings.h"
// the file NetworkSettings.h must define 3 constants:
// const char* ssid = "...";
// const char* password = "...";
// const char* mqtt_server = "192.168.1.106";


uint8_t MAC_array[6];
char MAC_char[18];
char client_ID[50];
char motor_topic[50];
char led_topic[50];
char state_topic[50];

void callback(char* topic, byte* payload, unsigned int length);
void setup_wifi();

WiFiClient espClient;
PubSubClient client(espClient);
long lastMsg = 0;
char msg[50];
int value = 0;

void setup() {
    pinMode(2, OUTPUT);
    digitalWrite(2, 0);
    pinMode(BUILTIN_LED, OUTPUT);     // Initialize the BUILTIN_LED pin as an output
    Serial.begin(115200);
    setup_wifi();
    client.setServer(mqtt_server, 1883);
    client.setCallback(callback);


    pinMode(5, OUTPUT);
    pinMode(4, OUTPUT);
    pinMode(0, OUTPUT);
    pinMode(2, OUTPUT);

    digitalWrite(5, 0);
    digitalWrite(4, 0);

    digitalWrite(0, 1);
    digitalWrite(2, 1);

    WiFi.macAddress(MAC_array);
    for (int i = 0; i < sizeof(MAC_array); ++i){
        sprintf(MAC_char,"%s%02X",MAC_char,MAC_array[i]);
    }

    sprintf (client_ID, "ESP8266_%s", MAC_char);
    sprintf (motor_topic, "%s/motor", MAC_char);
    sprintf (led_topic, "%s/led", MAC_char);
    sprintf (state_topic, "%s/state", MAC_char);

    Serial.println(MAC_char);

}

void setup_wifi() {

    delay(10);
    // We start by connecting to a WiFi network
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
    Serial.print("Message arrived [");
    Serial.print(topic);
    Serial.print("] ");
    for (int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
    }
    Serial.println();

    String data ((char*)payload);

    if (String (topic) == String (motor_topic))
    {
        int32_t amplitude = data.toInt ();
        if (0 > amplitude)
        {
            digitalWrite(2, 1);
        } else
        {
            digitalWrite(2, 0);
        }
        amplitude = (abs (amplitude) * 4) + 4;
        if (1023<amplitude) {
            amplitude = 1023;
        }
        analogWrite(4, amplitude);
    }
    else  if (String (topic) == String (led_topic))
    {
        if ( data.toInt () != 0) {
            digitalWrite (BUILTIN_LED, LOW); // LED is active low
        }else {
            digitalWrite (BUILTIN_LED, HIGH);
        }
    }
}


void reconnect() {
    // Loop until we're reconnected
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        // Attempt to connect
        if (client.connect(client_ID)) {
            Serial.println("connected");
            // Once connected, publish an announcement...
            client.publish(state_topic, "connected");
            // ... and resubscribe
            client.subscribe(motor_topic);
            client.subscribe(led_topic);
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            // Wait 5 seconds before retrying
            delay(5000);
        }
    }
}
void loop() {

    if (!client.connected()) {
        reconnect();
    }
    client.loop();

    long now = millis();
    if (now - lastMsg > 2000) {
        lastMsg = now;
        ++value;
        snprintf (msg, 75, "hello world #%ld", value);
        Serial.print("Publish message: ");
        Serial.println(msg);
        client.publish(state_topic, msg);
    }
}
