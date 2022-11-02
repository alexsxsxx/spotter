import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart' hide MenuItem;
import 'package:hotkey_manager/hotkey_manager.dart';
import 'package:system_tray/system_tray.dart';
import 'package:window_manager/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await windowManager.ensureInitialized();

  await hotKeyManager.unregisterAll();

  WindowOptions windowOptions = const WindowOptions(
    size: Size(800, 200),
    center: true,
    backgroundColor: Colors.transparent,
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.hidden,
  );
  windowManager.waitUntilReadyToShow(windowOptions, () async {
    print("READY TO SHOW!");
    await windowManager.show();
    await windowManager.focus();
  });
  // await hotKeyManager.unregisterAll();


  HotKey openHotKey = HotKey(
    KeyCode.keyS,
    modifiers: [KeyModifier.control, KeyModifier.shift],
    // Set hotkey scope (default is HotKeyScope.system)
    // scope: HotKeyScope.inapp, // Set as inapp-wide hotkey.
  );
  await hotKeyManager.register(
    openHotKey,
    keyDownHandler: (hotKey) {
      print('onKeyDown+${hotKey.toJson()}');
    },
    // Only works on macOS.
    keyUpHandler: (hotKey){
      print('onKeyUp+${hotKey.toJson()}');
    } ,
  );

  HotKey closeHotKey = HotKey(
    KeyCode.escape,
    modifiers: [KeyModifier.control],
    scope: HotKeyScope.inapp,
  );
  // final AppWindow appWindow = AppWindow();
  await hotKeyManager.register(
    closeHotKey,
    keyDownHandler: (hotKey) async {
      print("CLOSE");
      print('onKeyDown+${hotKey.toJson()}');
      await windowManager.hide();
      // await windowManager.show();
    },
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        // scaffoldBackgroundColor: Colors.transparent,
      ),
      home: const MyHomePage(
        title: 'Flutter Demo Home Page',
      ),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class Option {
  final String id;
  final String name;

  Option({
    required this.id,
    required this.name,
  });
}

String getTrayImagePath(String imageName) {
  return Platform.isWindows ? 'assets/$imageName.ico' : 'assets/$imageName.png';
}

String getImagePath(String imageName) {
  return Platform.isWindows ? 'assets/$imageName.bmp' : 'assets/$imageName.png';
}

class _MyHomePageState extends State<MyHomePage> {
  final AppWindow _appWindow = AppWindow();
  final SystemTray _systemTray = SystemTray();
  final Menu _menuMain = Menu();

  final searchTextController = new TextEditingController();

  List<Option> options = [
    Option(id: '1', name: 'Alacritty'),
    Option(id: '2', name: 'Brave browser'),
  ];

  List<Option> filteredOptions = [];

  @override
  void initState() {
    super.initState();

    initSystemTray();
    searchTextController.addListener(_printLatestValue);

    initServer();
  }

  Future<void> initServer() async {
    var server = await HttpServer.bind(InternetAddress.anyIPv6, 3212);
    await server.forEach((HttpRequest request) async {
    
      _appWindow.show();
      // await windowManager.show();
      // await windowManager.focus();

      request.response.write('Hello, world!');
      request.response.close();
    });
  }

  Future<void> initSystemTray() async {

    await _systemTray.initSystemTray(iconPath: getTrayImagePath('app_icon'));
    _systemTray.setTitle("system tray");
    _systemTray.setToolTip("How to use system tray with Flutter");

    _systemTray.registerSystemTrayEventHandler((eventName) {
      debugPrint("eventName: $eventName");
      if (eventName == kSystemTrayEventClick) {
        Platform.isWindows ? _appWindow.show() : _systemTray.popUpContextMenu();
      } else if (eventName == kSystemTrayEventRightClick) {
        Platform.isWindows ? _systemTray.popUpContextMenu() : _appWindow.show();
      }
    });

    await _menuMain.buildFrom(
      [
        MenuItemLabel(
            label: 'Show',
            image: getImagePath('darts_icon'),
            onClicked: (menuItem) async => {
              await windowManager.show(),
              await windowManager.focus()
            },
        ),
        MenuItemLabel(
            label: 'Hide',
            image: getImagePath('darts_icon'),
            onClicked: (menuItem) => _appWindow.hide()),
        MenuSeparator(),
        MenuItemLabel(
            label: 'Exit', onClicked: (menuItem) => _appWindow.close()
        ),
      ]
    );

    _systemTray.setContextMenu(_menuMain);
  }

  @override
  void dispose() {
    searchTextController.dispose();
    super.dispose();
  }

  void _printLatestValue() {
    print('Second text field: ${searchTextController.text}');
    setState(() {
      filteredOptions = options.where((option) => option.name.toLowerCase().contains(searchTextController.text)).toList();
    });
  }

  // @override
  // void onWindowBlur() async {
  //   print("heeey");
  //   // await windowManager.hide();
  // }

  @override
  Widget build(BuildContext context) {
    var focusNode = FocusNode();
    return Scaffold(
      // appBar: AppBar(
      //   title: Text(widget.title),
      // ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            TextField(
              controller: searchTextController,
              autofocus: true,
              decoration: const InputDecoration(
                border: InputBorder.none,
                labelText: 'Query...',
              )
            ),
            Row(children: [
              for(var option in filteredOptions) Text(option.name)
            ]),
          ],
        ),
      ),
    );
  }
}
