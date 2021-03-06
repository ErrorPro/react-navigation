import * as React from 'react';
import type {
  NavigationAction,
  NavigationState,
  ParamListBase,
  Router,
} from '@react-navigation/routers';
import SceneView from './SceneView';
import NavigationBuilderContext, {
  ChildActionListener,
  FocusedNavigationListener,
  NavigatorStateGetter,
} from './NavigationBuilderContext';
import type { NavigationEventEmitter } from './useEventEmitter';
import useNavigationCache from './useNavigationCache';
import type {
  Descriptor,
  NavigationHelpers,
  RouteConfig,
  RouteProp,
  EventMapBase,
} from './types';
import NavigationContext from './NavigationContext';
import NavigationRouteContext from './NavigationRouteContext';

type Options<
  State extends NavigationState,
  ScreenOptions extends {},
  EventMap extends EventMapBase
> = {
  state: State;
  screens: Record<
    string,
    RouteConfig<ParamListBase, string, State, ScreenOptions, EventMap>
  >;
  navigation: NavigationHelpers<ParamListBase>;
  screenOptions?:
    | ScreenOptions
    | ((props: {
        route: RouteProp<ParamListBase, string>;
        navigation: any;
      }) => ScreenOptions);
  onAction: (
    action: NavigationAction,
    visitedNavigators?: Set<string>
  ) => boolean;
  getState: () => State;
  setState: (state: State) => void;
  addActionListener: (listener: ChildActionListener) => void;
  addFocusedListener: (listener: FocusedNavigationListener) => void;
  addStateGetter: (key: string, getter: NavigatorStateGetter) => void;
  onRouteFocus: (key: string) => void;
  router: Router<State, NavigationAction>;
  emitter: NavigationEventEmitter;
};

/**
 * Hook to create descriptor objects for the child routes.
 *
 * A descriptor object provides 3 things:
 * - Helper method to render a screen
 * - Options specified by the screen for the navigator
 * - Navigation object intended for the route
 */
export default function useDescriptors<
  State extends NavigationState,
  ScreenOptions extends {},
  EventMap extends EventMapBase
>({
  state,
  screens,
  navigation,
  screenOptions,
  onAction,
  getState,
  setState,
  addActionListener,
  addFocusedListener,
  addStateGetter,
  onRouteFocus,
  router,
  emitter,
}: Options<State, ScreenOptions, EventMap>) {
  const [options, setOptions] = React.useState<Record<string, object>>({});
  const { onDispatchAction, onOptionsChange } = React.useContext(
    NavigationBuilderContext
  );

  const context = React.useMemo(
    () => ({
      navigation,
      onAction,
      addActionListener,
      addFocusedListener,
      addStateGetter,
      onRouteFocus,
      onDispatchAction,
      onOptionsChange,
    }),
    [
      addActionListener,
      addFocusedListener,
      addStateGetter,
      navigation,
      onAction,
      onDispatchAction,
      onRouteFocus,
      onOptionsChange,
    ]
  );

  const navigations = useNavigationCache<State, ScreenOptions>({
    state,
    getState,
    navigation,
    setOptions,
    router,
    emitter,
  });

  return state.routes.reduce<
    Record<string, Descriptor<ParamListBase, string, State, ScreenOptions>>
  >((acc, route) => {
    const screen = screens[route.name];
    const navigation = navigations[route.key];

    const routeOptions = {
      // The default `screenOptions` passed to the navigator
      ...(typeof screenOptions === 'object' || screenOptions == null
        ? screenOptions
        : // @ts-ignore: this is a function, but typescript doesn't think so
          screenOptions({
            // @ts-ignore
            route,
            navigation,
          })),
      // The `options` prop passed to `Screen` elements
      ...(typeof screen.options === 'object' || screen.options == null
        ? screen.options
        : // @ts-ignore: this is a function, but typescript doesn't think so
          screen.options({
            // @ts-ignore
            route,
            // @ts-ignore
            navigation,
          })),
      // The options set via `navigation.setOptions`
      ...options[route.key],
    };

    acc[route.key] = {
      navigation,
      render() {
        return (
          <NavigationBuilderContext.Provider key={route.key} value={context}>
            <NavigationContext.Provider value={navigation}>
              <NavigationRouteContext.Provider value={route}>
                <SceneView
                  navigation={navigation}
                  route={route}
                  screen={screen}
                  getState={getState}
                  setState={setState}
                  options={routeOptions}
                />
              </NavigationRouteContext.Provider>
            </NavigationContext.Provider>
          </NavigationBuilderContext.Provider>
        );
      },
      options: routeOptions as ScreenOptions,
    };

    return acc;
  }, {});
}
