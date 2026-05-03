import { hasPermissions } from './permissions'
import { hasMatchingRole } from './roles'
import type { AuthzRouteMap, AuthzSnapshot, PermissionInput } from './types'

type StringKey<T> = Extract<keyof T, string>
type Expand<T> = { [K in keyof T]: T[K] } & {}
type UnionKeys<T> = T extends unknown ? keyof T : never

type AddMissingUnionKeys<T, TUnion> = Expand<
  T & {
    [K in Exclude<UnionKeys<TUnion>, keyof T>]?: never
  }
>

type AddMissingKnownKeys<T, TKnown> = Expand<
  T & {
    [K in Exclude<keyof TKnown, keyof T>]?: TKnown[K]
  }
>

type NormalizeNavigationMember<T, TUnion, TKnown> = AddMissingKnownKeys<
  AddMissingUnionKeys<T, TUnion>,
  TKnown
>

type KnownNavigationNodeKeys = {
  title: never
  backHref: never
  direction: never
  name: never
  label: never
  exact: never
  rightContent: never
}

export type AuthzNavigationNode<TRoutes extends AuthzRouteMap> = Record<string, unknown> & {
  route?: StringKey<TRoutes>
  children?: readonly AuthzNavigationNode<TRoutes>[]
}

export type AuthzNavigationConfig<TRoutes extends AuthzRouteMap> = Record<
  string,
  AuthzNavigationNode<TRoutes>
>

export type AuthzNavigationDefinition<
  TRoutes extends AuthzRouteMap,
  TNavigation extends AuthzNavigationConfig<TRoutes>,
> = {
  routes: TRoutes
  areas: TNavigation
}

type RouteForNode<TRoutes extends AuthzRouteMap, TNode extends AuthzNavigationNode<TRoutes>> =
  TNode['route'] extends StringKey<TRoutes> ? TRoutes[TNode['route']] : Record<never, never>

type PathForNode<TRoutes extends AuthzRouteMap, TNode extends AuthzNavigationNode<TRoutes>> =
  RouteForNode<TRoutes, TNode> extends { path: infer TPath } ? TPath : never

type RouteOwnedNavigationKeys = 'path' | 'permissions' | 'roles' | 'match'

type RouteOwnedNavigationData<T> = Pick<T, Extract<keyof T, RouteOwnedNavigationKeys>>

type RawAllowedNavigationNode<
  TRoutes extends AuthzRouteMap,
  TNode extends AuthzNavigationNode<TRoutes>,
  TNodeUnion extends AuthzNavigationNode<TRoutes> = TNode,
> = Expand<
  Omit<
    RouteForNode<TRoutes, TNode>,
    Exclude<keyof TNode, RouteOwnedNavigationKeys> | 'children' | 'href'
  > &
    Omit<TNode, RouteOwnedNavigationKeys | 'children' | 'href'> &
    RouteOwnedNavigationData<RouteForNode<TRoutes, TNode>> & {
      href: PathForNode<TRoutes, TNode>
      children: Array<AuthzAllowedNavigationNode<TRoutes, ChildNode<TNode>, ChildNode<TNodeUnion>>>
    }
>

type RawAllowedNavigationNodeUnion<
  TRoutes extends AuthzRouteMap,
  TNodeUnion extends AuthzNavigationNode<TRoutes>,
> =
  TNodeUnion extends AuthzNavigationNode<TRoutes>
    ? RawAllowedNavigationNode<TRoutes, TNodeUnion, TNodeUnion>
    : never

type ChildNode<TNode> = TNode extends { children?: readonly (infer TChild)[] }
  ? TChild extends AuthzNavigationNode<AuthzRouteMap>
    ? TChild
    : never
  : never

export type AuthzAllowedNavigationNode<
  TRoutes extends AuthzRouteMap,
  TNode extends AuthzNavigationNode<TRoutes>,
  TNodeUnion extends AuthzNavigationNode<TRoutes> = TNode,
> =
  TNode extends AuthzNavigationNode<TRoutes>
    ? NormalizeNavigationMember<
        RawAllowedNavigationNode<TRoutes, TNode, TNodeUnion>,
        RawAllowedNavigationNodeUnion<TRoutes, TNodeUnion>,
        KnownNavigationNodeKeys
      >
    : never

export type AuthzAllowedNavigation<
  TRoutes extends AuthzRouteMap,
  TNavigation extends AuthzNavigationConfig<TRoutes>,
> = {
  [TArea in keyof TNavigation]: AuthzAllowedNavigationNode<
    TRoutes,
    TNavigation[TArea],
    TNavigation[keyof TNavigation]
  >
}

export function defineNavigation<
  const TRoutes extends AuthzRouteMap,
  const TNavigation extends AuthzNavigationConfig<TRoutes>,
>(routes: TRoutes, areas: TNavigation): AuthzNavigationDefinition<TRoutes, TNavigation> {
  return { routes, areas }
}

function canAccessNavigationRoute(
  route: AuthzRouteMap[string],
  snapshot?: Pick<AuthzSnapshot, 'roles' | 'permissions'> | null
) {
  return (
    hasMatchingRole(snapshot?.roles ?? [], route.roles, route.match) &&
    hasPermissions(snapshot?.permissions ?? {}, route.permissions as PermissionInput | undefined)
  )
}

function getAllowedNavigationNode<TRoutes extends AuthzRouteMap>(
  routes: TRoutes,
  node: AuthzNavigationNode<TRoutes>,
  snapshot?: Pick<AuthzSnapshot, 'roles' | 'permissions'> | null,
  options?: { preserveEmpty?: boolean }
): Record<string, unknown> | null {
  const route = node.route ? routes[node.route] : null

  if (route && !canAccessNavigationRoute(route, snapshot)) {
    return null
  }

  const children = (node.children ?? []).flatMap((child) => {
    const allowedChild = getAllowedNavigationNode(routes, child, snapshot)
    return allowedChild ? [allowedChild] : []
  })

  if (!route && node.children && children.length === 0 && !options?.preserveEmpty) {
    return null
  }

  return {
    ...(route ?? {}),
    ...node,
    ...(route
      ? {
          path: route.path,
          permissions: route.permissions,
          roles: route.roles,
          match: route.match,
        }
      : {}),
    href: route?.path,
    children,
  }
}

export function getAllowedNavigation<
  const TRoutes extends AuthzRouteMap,
  const TNavigation extends AuthzNavigationConfig<TRoutes>,
>(
  navigation: AuthzNavigationDefinition<TRoutes, TNavigation>,
  snapshot?: Pick<AuthzSnapshot, 'roles' | 'permissions'> | null
): AuthzAllowedNavigation<TRoutes, TNavigation> {
  const entries = Object.entries(navigation.areas).flatMap(([areaKey, area]) => {
    const allowedArea = getAllowedNavigationNode(navigation.routes, area, snapshot, {
      preserveEmpty: true,
    })

    if (allowedArea) {
      return [[areaKey, allowedArea] as const]
    }

    if (area.route) {
      return []
    }

    return [
      [
        areaKey,
        {
          ...area,
          href: undefined,
          children: [],
        },
      ] as const,
    ]
  })

  return Object.fromEntries(entries) as unknown as AuthzAllowedNavigation<TRoutes, TNavigation>
}
