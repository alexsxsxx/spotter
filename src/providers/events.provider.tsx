import {
  InputCommand,
  InputCommandType,
  Storage,
} from '@spotter-app/core/dist/interfaces';
import React, { FC, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import pDebounce from 'p-debounce';
import { PREINSTALL_PLUGINS_LIST, SHOW_OPTIONS_DELAY, SPOTTER_HOTKEY_IDENTIFIER } from '../core/constants';
import {
  InternalPluginLifecycle,
  PluginOutputCommand,
  RegisteredOptions,
  SpotterHotkeyEvent,
  ExternalPluginOption,
  InternalPluginOption,
  isExternalPluginOption,
  RegisteredPrefixes,
  SpotterShell,
} from '../core/interfaces';
import { useApi } from './api.provider';
import { Settings, useSettings } from './settings.provider';
import { PluginsPlugin } from '../plugins/plugins.plugin';
import {
  forceReplaceOptions,
  getHistoryPath,
  handleCommands,
  onQueryExternalPluginAction,
  onQueryInternalPluginAction,
  sortOptions,
  triggerOnInitForInternalOrExternalPlugin,
  triggerOnInitForInternalAndExternalPlugins,
  checkForPluginsPrefixesToRegister,
  isLocalPluginPath,
  checkForPluginPrefixesToRegister,
  onPrefixForPlugins,
} from '../core/helpers';
import { useHistory } from './history.provider';
import { useStorage } from './storage.provider';
import { useSpotterState } from './state.provider';

type Context = {
  onQuery: (query: string) => Promise<void>,
  onSubmit: (index?: number) => void,
  onArrowUp: () => void,
  onArrowDown: () => void,
  onEscape: () => void,
  onCommandComma: () => void,
  onTab: () => void,
  onBackspace: () => void,
  query: string,
  hint?: string,
  options: Array<InternalPluginOption | ExternalPluginOption>,
  selectedOption: InternalPluginOption | ExternalPluginOption | null,
  loading: boolean,
  hoveredOptionIndex: number,
  shouldShowOptions: boolean,
  waitingFor: string | null,
};

const context: Context = {
  onQuery: () => Promise.resolve(),
  onSubmit: () => null,
  onArrowUp: () => null,
  onArrowDown: () => null,
  onEscape: () => null,
  onCommandComma: () => null,
  onTab: () => null,
  onBackspace: () => null,
  query: '',
  hint: '',
  options: [],
  selectedOption: null,
  loading: false,
  hoveredOptionIndex: 0,
  shouldShowOptions: false,
  waitingFor: null,
}

export const EventsContext = React.createContext<Context>(context);

export const EventsProvider: FC<{}> = (props) => {

  const { api } = useApi();
  const { getSettings, addPlugin, removePlugin } = useSettings();
  const { getHistory, increaseHistory } = useHistory();
  const { getStorage, patchStorage } = useStorage();
  const {
    query,
    setQuery,
    hint,
    setHint,
    options,
    setOptions,
    selectedOption,
    setSelectedOption,
    loading,
    setLoading,
    waitingFor,
    setWaitingFor,
    hoveredOptionIndex,
    setHoveredOptionIndex,
    shouldShowOptions,
    setShouldShowOptions,
  } = useSpotterState()

  const [ registeredOptions, setRegisteredOptions ] = useState<RegisteredOptions>({});
  const [ registeredPrefixes, setRegisteredPrefixes ] = useState<RegisteredPrefixes>({});

  const shouldShowOptionsTimer = useRef<NodeJS.Timeout | null>();

  const debouncedOnPrefixForPlugins = useRef<(registeredPrefixes: RegisteredPrefixes, query: string, shell: SpotterShell, storage: Storage) => Promise<PluginOutputCommand[]>>();

  const registerPlugin = async (settings: Settings, plugin: string) => {
    if (settings.plugins.find(p => p === plugin)) {
      return;
    }

    const localPluginPath = RegExp('^(.+)\/([^\/]+)$').test(plugin);

    if (!localPluginPath) {
      await api.shell.execute(`npm i -g ${plugin}`);
    }

    addPlugin(plugin);
    const pluginStorage = await getStorage(plugin);

    const onInitCommands = await triggerOnInitForInternalOrExternalPlugin(
      plugin,
      api.shell,
      pluginStorage,
    );

    const prefixesCommands = await checkForPluginPrefixesToRegister(
      plugin,
      api.shell,
    );

    const commands = [
      ...onInitCommands,
      ...prefixesCommands,
    ];

    const {
      optionsToRegister,
      dataToStorage,
      prefixesToRegister,
      errorsToSet,
    } = handleCommands(commands);

    if (errorsToSet) {
      errorsToSet.forEach(err => Alert.alert(err));
    }

    if (prefixesToRegister) {
      setRegisteredPrefixes(prevPrefixes => ({
        ...prevPrefixes,
        ...prefixesToRegister,
      }));
    }

    if (dataToStorage) {
      patchStorage(dataToStorage);
    }

    if (optionsToRegister) {
      setRegisteredOptions(prevOptions => ({
        ...prevOptions,
        ...optionsToRegister,
      }));
    }
  }

  const unregisterPlugin = async (plugin: string) => {
    const localPluginPath = RegExp('^(.+)\/([^\/]+)$').test(plugin);

    if (!localPluginPath) {
      await api.shell.execute(`npm uninstall -g ${plugin}`);
    }

    removePlugin(plugin);
    setRegisteredOptions((prevRegisteredOptions) => ({
      ...prevRegisteredOptions,
      [plugin]: [],
    }));
    setRegisteredPrefixes((prevRegisteredOptions) => ({
      ...prevRegisteredOptions,
      [plugin]: [],
    }));
    reset();
  }

  const internalPlugins: InternalPluginLifecycle[] = [
    new PluginsPlugin(api, getSettings, registerPlugin, unregisterPlugin),
  ];

  useEffect(() => {
    onInit();

    if (!debouncedOnPrefixForPlugins.current) {
      debouncedOnPrefixForPlugins.current = pDebounce(onPrefixForPlugins, 200);
    }
  }, []);

  // TODO: move to spotter.tsx
  const onInit = async () => {
    const settings = await getSettings();

    setWaitingFor('Installing dependencies...');
    await installDependencies();

    setWaitingFor('Registering hotkeys...');
    registerGlobalHotkeys(settings);

    if (!settings.pluginsPreinstalled) {
      setWaitingFor('Installing plugins...');
      await preinstallPlugins(settings);
    }

    setWaitingFor(null);

    const internalAndExternalPLugins = [
      ...internalPlugins,
      ...settings.plugins,
    ];

    const onInitCommands = await triggerOnInitForInternalAndExternalPlugins(
      internalAndExternalPLugins,
      api.shell,
      getStorage,
    );

    const prefixesCommands = await checkForPluginsPrefixesToRegister(
      settings.plugins,
      api.shell,
    );

    const commands = [
      ...onInitCommands,
      ...prefixesCommands,
    ];

    const {
      optionsToRegister,
      optionsToSet,
      dataToStorage,
      prefixesToRegister,
      errorsToSet,
    } = handleCommands(commands);

    if (errorsToSet?.length) {
      errorsToSet.forEach(err => Alert.alert(err));
    }

    if (prefixesToRegister) {
      setRegisteredPrefixes(prevPrefixes => ({
        ...prevPrefixes,
        ...prefixesToRegister,
      }));
    }

    if (dataToStorage) {
      patchStorage(dataToStorage)
    }

    if (optionsToSet) {
      const history = await getHistory();
      setOptions(
        sortOptions(
          forceReplaceOptions(optionsToSet),
          selectedOption,
          history,
        ),
      );
    }

    if (optionsToRegister) {
      setRegisteredOptions(prevOptions => ({
        ...prevOptions,
        ...optionsToRegister,
      }));
    }
  };

  const registerGlobalHotkeys = async (settings: Settings) => {
    api.globalHotKey.register(settings?.hotkey, SPOTTER_HOTKEY_IDENTIFIER);

    Object.entries(settings.pluginHotkeys).forEach(([plugin, options]) => {
      Object.entries(options).forEach(([option, hotkey]) => {
        api.globalHotKey.register(hotkey, `${plugin}#${option}`);
      });
    });

    api.globalHotKey.onPress(e => onPressHotkey(e));
  }

  const installDependencies = async () => {
    const nodeInstalled = await api.shell.execute('node -v').catch(() => false);
    if (nodeInstalled) {
      return;
    }

    const brewInstalled = await api.shell.execute('brew -v').catch(() => false);
    if (!brewInstalled) {
      await api.shell.execute('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
    }

    await api.shell.execute('brew install node');
  }

  const preinstallPlugins = async (settings: Settings) => {
    return Promise.all(PREINSTALL_PLUGINS_LIST.map(
      p => registerPlugin(settings, p),
    ));
  }

  const onPressHotkey = (e: SpotterHotkeyEvent) => {
    if (e.identifier === SPOTTER_HOTKEY_IDENTIFIER) {
      api.panel.open();
      return;
    };
  }

  const reset = () => {
    setQuery('');
    setHint(null);
    setLoading(false);
    setOptions([]);
    setHoveredOptionIndex(0);
    setSelectedOption(null);
  }

  const onEscape = () => {
    reset();
    setShouldShowOptions(false);
    if (shouldShowOptionsTimer.current) {
      clearTimeout(shouldShowOptionsTimer.current);
    }
    shouldShowOptionsTimer.current = null;
    api.panel.close();
  }

  const onBackspace = () => {
    if (selectedOption && !query.length) {
      reset();
    }
  }

  const onTab = async () => {
    const option = options[hoveredOptionIndex];

    if (!option || !option.queryAction) {
      return;
    }

    setSelectedOption(option);
    setQuery('');

    const pluginStorage = await getStorage(option.plugin);
    const commands: PluginOutputCommand[] = isExternalPluginOption(option)
      ? await onQueryExternalPluginAction(
        option,
        '',
        api.shell,
        pluginStorage,
      )
      : await onQueryInternalPluginAction(option, '');

    const { optionsToSet, dataToStorage, hintToSet, logs } = handleCommands(commands);

    if (logs?.length) {
      logs.forEach(log => console.log(log));
    }

    if (dataToStorage) {
      patchStorage(dataToStorage);
    }

    if (hintToSet) {
      setHint(hintToSet);
    }

    increaseHistory(getHistoryPath(option, null));

    const history = await getHistory();
    setOptions(
      sortOptions(
       forceReplaceOptions(optionsToSet ?? []),
        option,
        history,
      ),
    );
    setHoveredOptionIndex(0);
  }

  const onQuery = async (q: string) => {
    // TODO: add warning message UI
    // if (!settings?.plugins?.filter(p => typeof p === 'string').length) {
      // setOptions([{
      //   title: 'You don`t have any installed plugins',
      //   plugin: '',
      // }]);
      // return;
    // }

    setQuery(q);

    if (selectedOption) {
      const pluginStorage = await getStorage(selectedOption.plugin);
      const commands: PluginOutputCommand[] = isExternalPluginOption(selectedOption)
        ? await onQueryExternalPluginAction(
          selectedOption,
          q,
          api.shell,
          pluginStorage,
        )
        : await onQueryInternalPluginAction(selectedOption, q);

      const { optionsToSet, dataToStorage, logs } = handleCommands(commands);

      if (logs?.length) {
        logs.forEach(log => console.log(log));
      }

      if (dataToStorage) {
        patchStorage(dataToStorage);
      }

      if (optionsToSet) {
        const history = await getHistory();
        setOptions(
          sortOptions(
            forceReplaceOptions(optionsToSet ?? []),
            selectedOption,
            history,
          ),
        );
      }

      return;
    }

    if (q === '') {
      reset();
      return;
    }

    setLoading(true);

    const shouldTriggerPrefixes: RegisteredPrefixes = Object
      .entries(registeredPrefixes)
      .reduce<RegisteredPrefixes>((acc, [plugin, prefixes]) => {
        const filteredPrefixes = prefixes.filter(prefix => q.startsWith(prefix));
        const updatedPrefixes = [
          ...(acc[plugin] ? acc[plugin] : []),
          ...filteredPrefixes,
        ];

        return {
          ...acc,
          ...(updatedPrefixes.length ? {[plugin]: updatedPrefixes} : {}),
        };
      }, {});

    const prefixesCommands = Object.keys(shouldTriggerPrefixes)?.length && debouncedOnPrefixForPlugins.current
      ? await debouncedOnPrefixForPlugins.current(
          shouldTriggerPrefixes,
          q,
          api.shell,
          getStorage,
        )
      : [];

    const { optionsToSet, queryToSet, logs } = handleCommands(prefixesCommands);

    if (logs?.length) {
      logs.forEach(log => console.log(log));
    }

    if (queryToSet) {
      setQuery(queryToSet);
    }

    const filteredRegisteredOptions = Object
      .values(registeredOptions)
      .flat(1)
      .filter(o => o.title.toLowerCase().search(q.toLowerCase()) !== -1);

    const options = [
      ...(optionsToSet ? optionsToSet : []),
      ...filteredRegisteredOptions,
    ];

    setLoading(false);

    const history = await getHistory();
    setOptions(
      sortOptions(
        forceReplaceOptions(options),
        selectedOption,
        history,
      ),
    );

    if (!shouldShowOptionsTimer.current) {
      shouldShowOptionsTimer.current = setTimeout(() => {
        setShouldShowOptions(prevShouldShowOptions => {
          if (!prevShouldShowOptions) {
            return true;
          }

          return prevShouldShowOptions;
        });
      }, SHOW_OPTIONS_DELAY);
    }
  };

  const onArrowUp = () => {
    if (hoveredOptionIndex <= 0) {
      setHoveredOptionIndex(options.length - 1);
      return;
    }

    setHoveredOptionIndex(hoveredOptionIndex - 1)
  };

  const onArrowDown = () => {
    if (hoveredOptionIndex >= options.length - 1) {
      setHoveredOptionIndex(0);
      return;
    }

    setHoveredOptionIndex(hoveredOptionIndex + 1)
  };

  const onSubmitInternalOption = (option: InternalPluginOption) => {
    if (option.action) {
      option.action();
    }

    onEscape();
    return;
  };

  const onSubmitExternalOption = async (option: ExternalPluginOption) => {
    const pluginStorage = await getStorage(option.plugin);
    const command: InputCommand = {
      type: InputCommandType.onAction,
      action: option.action ?? '',
      query,
      storage: pluginStorage,
    };

    const localPluginPath = isLocalPluginPath(option.plugin);

    const commands: PluginOutputCommand[] = await api.shell
      .execute(`${localPluginPath ? 'node ' : ''}${option.plugin} '${JSON.stringify(command)}'`)
      .then(v => parseCommands(option.plugin, v));

    const { dataToStorage, optionsToSet, logs } = handleCommands(commands);

    if (logs?.length) {
      logs.forEach(log => console.log(log));
    }

    if (dataToStorage) {
      patchStorage(dataToStorage);
    }

    if (optionsToSet) {
      const history = await getHistory();
      setOptions(
        sortOptions(
          forceReplaceOptions(optionsToSet),
          selectedOption,
          history,
        ),
      );
      return;
    }

    onEscape();
  }

  const onSubmit = async (index?: number) => {
    if (index || index === 0) {
      setHoveredOptionIndex(index);
    }

    const option = options[hoveredOptionIndex];

    if (!option) {
      return;
    }

    if (!option.action && option.queryAction) {
      onTab();
      return;
    }

    // setLoading(true);

    isExternalPluginOption(option)
      ? onSubmitExternalOption(option)
      : onSubmitInternalOption(option)

    increaseHistory(
      getHistoryPath(option, selectedOption),
    );
  }

  const parseCommands = (plugin: string, value: string): PluginOutputCommand[] => {
    return value ? value.split('\n').map(c => ({...JSON.parse(c), plugin})) : [];
  }

  return (
    <EventsContext.Provider value={{
      ...context,
      onQuery,
      onEscape,
      onArrowUp,
      onArrowDown,
      onTab,
      onBackspace,
      onSubmit,
      query,
      options,
      hint,
      loading,
      hoveredOptionIndex,
      shouldShowOptions,
      selectedOption,
      waitingFor,
    }}>
      {props.children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => React.useContext(EventsContext);
