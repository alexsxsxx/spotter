export type Storage<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens?: any, 
} & T;

export interface Settings {
  hotkey: Hotkey | null,
  pluginHotkeys: PluginHotkeys,
  theme: string,
}

export interface PluginRegistryEntry {
  name: string,
  path: string,
};

export interface Hotkey {
  keyCode: number,
  modifiers: number,
  doubledModifiers: boolean,
}

export type PluginHotkeys = {
  [plugin: string]: { [option: string]: Hotkey | null },
}

export type Icon = string;

export type Action = () => ActionResult;

export interface Option {
  title: string,
  subtitle?: string,
  icon?: Icon,
  replaceOptions?: string[],
  onSubmit?: Action,
  onQuery?: OnQueryAction,
  onQueryCancel?: () => void,
}

export type RegistryOption = Option & {
  prefix?: string,
}

export type OnQueryOption = Option & {
  hovered?: boolean,
  onHover?: Action,
}

export type SpotterRegistryOption = SpotterOption & {
  prefix?: string,
}

export type SpotterOnQueryOption = SpotterOption & {
  hovered?: boolean,
  onHoverId?: string,
}

export function isSpotterOnQueryOption(
  value: Option | OnQueryOption): value is OnQueryOption {
    return (value as OnQueryOption).onHover !== undefined ||
    (value as OnQueryOption).hovered !== undefined
}

export interface SpotterOption {
  title: string,
  subtitle?: string,
  onSubmitId?: string | null,
  onHoverId?: string | null,
  onQueryId?: string | null,
  onQueryCancelId?: string | null,
  icon?: Icon,
  replaceOptions?: string[],
}

export type ActionResult =
  Promise<OnQueryOption[] | boolean | void> | OnQueryOption[] | boolean | void;

export type OnQueryAction = (query: string) => ActionResult;

export enum CommandType {
  setOnQueryOptions = 'setOnQueryOptions',
  setQuery = 'setQuery',
  setError = 'setError',
  patchStorage = 'patchStorage',
  setStorage = 'setStorage',
  getStorage = 'getStorage',
  setPlaceholder = 'setPlaceholder',
  setRegisteredOptions = 'setRegisteredOptions',
  patchRegisteredOptions = 'patchRegisteredOptions',
  patchSettings = 'patchSettings',
  getSettings = 'getSettings',
  startPluginScript = 'startPluginScript',
  getPlugins = 'getPlugins',
  addPlugin = 'addPlugin',
  connectPlugin = 'connectPlugin',
  updatePlugin = 'updatePlugin',
  removePlugin = 'removePlugin',
  setTheme = 'setTheme',
  open = 'open',
  close = 'close',
}

export interface ConnectPluginData {
  name: string,
  path: string,
  port: number,
  pid: number,
}

export type Command = {
  type: CommandType.setOnQueryOptions,
  value: SpotterOnQueryOption[],
} | {
  type: CommandType.setQuery,
  value: string,
} | {
  type: CommandType.setPlaceholder,
  value: string,
} | {
  type: CommandType.setError,
  value: string,
} | {
  type: CommandType.setStorage,
  value: Storage<unknown>,
} | {
  type: CommandType.getStorage,
  value: string,
} | {
  type: CommandType.patchStorage,
  value: Storage<unknown>,
} | {
  type: CommandType.setRegisteredOptions,
  value: SpotterOption[],
} | {
  type: CommandType.patchRegisteredOptions,
  value: SpotterOption[],
} | {
  type: CommandType.patchSettings,
  value: Partial<Settings>,
} | {
  type: CommandType.getSettings,
  value: string,
} | {
  type: CommandType.getPlugins,
  value: string,
} | {
  type: CommandType.startPluginScript,
  value: string,
} | {
  type: CommandType.addPlugin,
  value: string,
} | {
  type: CommandType.connectPlugin,
  value: ConnectPluginData,
} | {
  type: CommandType.updatePlugin,
  value: string,
} | {
  type: CommandType.removePlugin,
  value: string,
} | {
  type: CommandType.setTheme,
  value: string,
} | {
  type: CommandType.open,
} | {
  type: CommandType.close,
}

export enum SpotterCommandType {
  onInit = 'onInit',
  onSubmit = 'onSubmit',
  onHover = 'onHover',
  onQuery = 'onQuery',
  onQueryCancel = 'onQueryCancel',
  onGetStorage = 'onGetStorage',
  onGetSettings = 'onGetSettings',
  onGetPlugins = 'onGetPlugins',
}

export type SpotterOnInitCommand = {
  type: SpotterCommandType.onInit;
}

export type SpotterOnSubmitCommand = {
  type: SpotterCommandType.onSubmit,
  onSubmitId: string,
}

export type SpotterOnHoverCommand = {
  type: SpotterCommandType.onHover,
  onHoverId: string,
}

export type SpotterOnQueryCommand = {
  type: SpotterCommandType.onQuery,
  onQueryId: string,
  query: string,
}

export type SpotterOnQueryCancelCommand = {
  type: SpotterCommandType.onQueryCancel,
  onQueryCancelId: string,
}

export type SpotterOnGetSettingsCommand = {
  type: SpotterCommandType.onGetSettings,
  value: {
    id: string,
    data: Settings,
  },
}

export type SpotterOnGetStorageCommand = {
  type: SpotterCommandType.onGetStorage,
  value: {
    id: string,
    data: Storage<unknown>,
  },
}

export type SpotterOnGetPluginsCommand = {
  type: SpotterCommandType.onGetPlugins,
  value: {
    id: string,
    data: PluginRegistryEntry[],
  },
}

export type SpotterCommand = SpotterOnInitCommand
  | SpotterOnSubmitCommand
  | SpotterOnHoverCommand
  | SpotterOnQueryCommand
  | SpotterOnQueryCancelCommand 
  | SpotterOnGetSettingsCommand
  | SpotterOnGetStorageCommand
  | SpotterOnGetPluginsCommand;

export interface ChannelCreator {
  on: (event: 'connection', callback: (channel: Channel) => void) => void,
}

export type ChannelEventType = 'message'
  | 'open'
  | 'error'
  | 'close';

export type Channel = ChannelForSpotter | ChannelForPlugin;

export interface ChannelForSpotter {
  sendToPlugin: (value: string) => void,
  onPlugin: (e: ChannelEventType, callback: (data: string) => void) => void,
  close: () => void,
}

export interface ChannelForPlugin {
  sendToSpotter: (value: string) => void,
  onSpotter: (e: ChannelEventType, callback: (data: string) => void) => void,
}
