/*@refresh skip*/

import type { Component, JSX } from "solid-js";
import { children, createMemo, createRoot, mergeProps, on, Show } from "solid-js";
import {
  createBranches,
  createRouteContext,
  createRouterContext,
  getRouteMatches,
  RouteContextObj,
  RouterContextObj
} from "../routing";
import type {
  MatchFilters,
  Params,
  RouteContext,
  RouteLoadFunc,
  RouteDefinition,
  RouterIntegration,
  RouterContext,
  Branch,
  RouteSectionProps
} from "../types";
import { createMemoObject } from "../utils";

export type RouterProps = {
  base?: string;
  actionBase?: string;
  root?: Component<RouteSectionProps>;
  children?: JSX.Element;
};

export const createRouterComponent = (router: RouterIntegration) => (props: RouterProps) => {
  const { base, actionBase } = props;
  const routeDefs = children(() => props.children) as unknown as () =>
    | RouteDefinition
    | RouteDefinition[];

  const branches = createMemo(() =>
    createBranches(
      props.root ? { component: props.root, children: routeDefs() } : routeDefs(),
      props.base || ""
    )
  );
  const routerState = createRouterContext(router, branches, { base, actionBase });
  router.create && router.create(routerState);

  return (
    <RouterContextObj.Provider value={routerState}>
      <Routes routerState={routerState} branches={branches()} />
    </RouterContextObj.Provider>
  );
};

function Routes(props: { routerState: RouterContext; branches: Branch[] }) {
  const matches = createMemo(() =>
    getRouteMatches(props.branches, props.routerState.location.pathname)
  );
  const params = createMemoObject(() => {
    const m = matches();
    const params: Params = {};
    for (let i = 0; i < m.length; i++) {
      Object.assign(params, m[i].params);
    }
    return params;
  });
  const disposers: (() => void)[] = [];
  let root: RouteContext | undefined;

  const routeStates = createMemo(
    on(matches, (nextMatches, prevMatches, prev: RouteContext[] | undefined) => {
      let equal = prevMatches && nextMatches.length === prevMatches.length;
      const next: RouteContext[] = [];
      for (let i = 0, len = nextMatches.length; i < len; i++) {
        const prevMatch = prevMatches && prevMatches[i];
        const nextMatch = nextMatches[i];

        if (prev && prevMatch && nextMatch.route.key === prevMatch.route.key) {
          next[i] = prev[i];
        } else {
          equal = false;
          if (disposers[i]) {
            disposers[i]();
          }

          createRoot(dispose => {
            disposers[i] = dispose;
            next[i] = createRouteContext(
              props.routerState,
              next[i - 1] || props.routerState.base,
              createOutlet(() => routeStates()[i + 1]),
              () => matches()[i],
              params
            );
          });
        }
      }

      disposers.splice(nextMatches.length).forEach(dispose => dispose());

      if (prev && equal) {
        return prev;
      }
      root = next[0];
      return next;
    })
  );
  return (
    <Show when={routeStates() && root} keyed>
      {route => <RouteContextObj.Provider value={route}>{route.outlet()}</RouteContextObj.Provider>}
    </Show>
  );
}

const createOutlet = (child: () => RouteContext | undefined) => {
  return () => (
    <Show when={child()} keyed>
      {child => <RouteContextObj.Provider value={child}>{child.outlet()}</RouteContextObj.Provider>}
    </Show>
  );
};

export type RouteProps<S extends string> = {
  path?: S | S[];
  children?: JSX.Element;
  load?: RouteLoadFunc;
  matchFilters?: MatchFilters<S>;
  component?: Component;
};

export const Route = <S extends string>(props: RouteProps<S>) => {
  const childRoutes = children(() => props.children);
  return mergeProps(props, {
    get children() {
      return childRoutes();
    }
  }) as unknown as JSX.Element;
};
