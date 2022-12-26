/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import ReactDOMSharedInternals from 'shared/ReactDOMSharedInternals.js';
const {
  Dispatcher
} = ReactDOMSharedInternals;
import { DOCUMENT_NODE } from '../shared/HTMLNodeType';
import { validateUnmatchedLinkResourceProps, validatePreloadResourceDifference, validateHrefKeyedUpdatedProps, validateStyleResourceDifference, validateLinkPropsForStyleResource, validateLinkPropsForPreloadResource, validatePreloadArguments, validatePreinitArguments } from '../shared/ReactDOMResourceValidation';
import { createElement, setInitialProperties } from './ReactDOMComponent';
import { getStylesFromRoot } from './ReactDOMComponentTree';
import { HTML_NAMESPACE } from '../shared/DOMNamespaces';
import { getCurrentRootHostContainer } from 'react-reconciler/src/ReactFiberHostContext'; // The resource types we support. currently they match the form for the as argument.
// In the future this may need to change, especially when modules / scripts are supported

// It is valid to preload even when we aren't actively rendering. For cases where Float functions are
// called when there is no rendering we track the last used document. It is not safe to insert
// arbitrary resources into the lastCurrentDocument b/c it may not actually be the document
// that the resource is meant to apply too (for example stylesheets or scripts). This is only
// appropriate for resources that don't really have a strict tie to the document itself for example
// preloads
let lastCurrentDocument = null;
let previousDispatcher = null;
export function prepareToRenderResources(rootContainer) {
  // Flot thinks that getRootNode returns a Node but it actually returns a
  // Document or ShadowRoot
  const rootNode = rootContainer.getRootNode();
  lastCurrentDocument = getDocumentFromRoot(rootNode);
  previousDispatcher = Dispatcher.current;
  Dispatcher.current = ReactDOMClientDispatcher;
}
export function cleanupAfterRenderResources() {
  Dispatcher.current = previousDispatcher;
  previousDispatcher = null;
} // We want this to be the default dispatcher on ReactDOMSharedInternals but we don't want to mutate
// internals in Module scope. Instead we export it and Internals will import it. There is already a cycle
// from Internals -> ReactDOM -> FloatClient -> Internals so this doesn't introduce a new one.

export const ReactDOMClientDispatcher = {
  preload,
  preinit
};
// global maps of Resources
const preloadResources = new Map();

function getCurrentResourceRoot() {
  const currentContainer = getCurrentRootHostContainer(); // $FlowFixMe flow should know currentContainer is a Node and has getRootNode

  return currentContainer ? currentContainer.getRootNode() : null;
} // Preloads are somewhat special. Even if we don't have the Document
// used by the root that is rendering a component trying to insert a preload
// we can still seed the file cache by doing the preload on any document we have
// access to. We prefer the currentDocument if it exists, we also prefer the
// lastCurrentDocument if that exists. As a fallback we will use the window.document
// if available.


function getDocumentForPreloads() {
  const root = getCurrentResourceRoot();

  if (root) {
    return root.ownerDocument || root;
  } else {
    try {
      return lastCurrentDocument || window.document;
    } catch (error) {
      return null;
    }
  }
}

function getDocumentFromRoot(root) {
  return root.ownerDocument || root;
} // --------------------------------------
//      ReactDOM.Preload
// --------------------------------------


function preload(href, options) {
  if (__DEV__) {
    validatePreloadArguments(href, options);
  }

  const ownerDocument = getDocumentForPreloads();

  if (typeof href === 'string' && href && typeof options === 'object' && options !== null && ownerDocument) {
    const as = options.as;
    const resource = preloadResources.get(href);

    if (resource) {
      if (__DEV__) {
        const originallyImplicit = resource._dev_implicit_construction === true;
        const latestProps = preloadPropsFromPreloadOptions(href, as, options);
        validatePreloadResourceDifference(resource.props, originallyImplicit, latestProps, false);
      }
    } else {
      const resourceProps = preloadPropsFromPreloadOptions(href, as, options);
      createPreloadResource(ownerDocument, href, resourceProps);
    }
  }
}

function preloadPropsFromPreloadOptions(href, as, options) {
  return {
    href,
    rel: 'preload',
    as,
    crossOrigin: as === 'font' ? '' : options.crossOrigin
  };
} // --------------------------------------
//      ReactDOM.preinit
// --------------------------------------


function preinit(href, options) {
  if (__DEV__) {
    validatePreinitArguments(href, options);
  }

  if (typeof href === 'string' && href && typeof options === 'object' && options !== null) {
    const resourceRoot = getCurrentResourceRoot();
    const as = options.as;

    if (!resourceRoot) {
      // We are going to emit a preload as a best effort fallback since this preinit
      // was called outside of a render. Given the passive nature of this fallback
      // we do not warn in dev when props disagree if there happens to already be a
      // matching preload with this href
      const preloadDocument = getDocumentForPreloads();

      if (preloadDocument) {
        const preloadResource = preloadResources.get(href);

        if (!preloadResource) {
          const preloadProps = preloadPropsFromPreinitOptions(href, as, options);
          createPreloadResource(preloadDocument, href, preloadProps);
        }
      }

      return;
    }

    switch (as) {
      case 'style':
        {
          const styleResources = getStylesFromRoot(resourceRoot);
          const precedence = options.precedence || 'default';
          let resource = styleResources.get(href);

          if (resource) {
            if (__DEV__) {
              const latestProps = stylePropsFromPreinitOptions(href, precedence, options);
              validateStyleResourceDifference(resource.props, latestProps);
            }
          } else {
            const resourceProps = stylePropsFromPreinitOptions(href, precedence, options);
            resource = createStyleResource(styleResources, resourceRoot, href, precedence, resourceProps);
          }

          acquireResource(resource);
        }
    }
  }
}

function preloadPropsFromPreinitOptions(href, as, options) {
  return {
    href,
    rel: 'preload',
    as,
    crossOrigin: as === 'font' ? '' : options.crossOrigin
  };
}

function stylePropsFromPreinitOptions(href, precedence, options) {
  return {
    rel: 'stylesheet',
    href,
    'data-rprec': precedence,
    crossOrigin: options.crossOrigin
  };
} // --------------------------------------
//      Resources from render
// --------------------------------------


// This function is called in begin work and we should always have a currentDocument set
export function getResource(type, pendingProps, currentProps) {
  const resourceRoot = getCurrentResourceRoot();

  if (!resourceRoot) {
    throw new Error('"resourceRoot" was expected to exist. This is a bug in React.');
  }

  switch (type) {
    case 'link':
      {
        const {
          rel
        } = pendingProps;

        switch (rel) {
          case 'stylesheet':
            {
              const styleResources = getStylesFromRoot(resourceRoot);
              let didWarn;

              if (__DEV__) {
                if (currentProps) {
                  didWarn = validateHrefKeyedUpdatedProps(pendingProps, currentProps);
                }

                if (!didWarn) {
                  didWarn = validateLinkPropsForStyleResource(pendingProps);
                }
              }

              const {
                precedence,
                href
              } = pendingProps;

              if (typeof href === 'string' && typeof precedence === 'string') {
                // We've asserted all the specific types for StyleQualifyingProps
                const styleRawProps = pendingProps; // We construct or get an existing resource for the style itself and return it

                let resource = styleResources.get(href);

                if (resource) {
                  if (__DEV__) {
                    if (!didWarn) {
                      const latestProps = stylePropsFromRawProps(styleRawProps);

                      if (resource._dev_preload_props) {
                        adoptPreloadProps(latestProps, resource._dev_preload_props);
                      }

                      validateStyleResourceDifference(resource.props, latestProps);
                    }
                  }
                } else {
                  const resourceProps = stylePropsFromRawProps(styleRawProps);
                  resource = createStyleResource(styleResources, resourceRoot, href, precedence, resourceProps);
                  immediatelyPreloadStyleResource(resource);
                }

                return resource;
              }

              return null;
            }

          case 'preload':
            {
              if (__DEV__) {
                validateLinkPropsForPreloadResource(pendingProps);
              }

              const {
                href,
                as
              } = pendingProps;

              if (typeof href === 'string' && isResourceAsType(as)) {
                // We've asserted all the specific types for PreloadQualifyingProps
                const preloadRawProps = pendingProps;
                let resource = preloadResources.get(href);

                if (resource) {
                  if (__DEV__) {
                    const originallyImplicit = resource._dev_implicit_construction === true;
                    const latestProps = preloadPropsFromRawProps(preloadRawProps);
                    validatePreloadResourceDifference(resource.props, originallyImplicit, latestProps, false);
                  }
                } else {
                  const resourceProps = preloadPropsFromRawProps(preloadRawProps);
                  resource = createPreloadResource(getDocumentFromRoot(resourceRoot), href, resourceProps);
                }

                return resource;
              }

              return null;
            }

          default:
            {
              if (__DEV__) {
                validateUnmatchedLinkResourceProps(pendingProps, currentProps);
              }

              return null;
            }
        }
      }

    default:
      {
        throw new Error(`getResource encountered a resource type it did not expect: "${type}". this is a bug in React.`);
      }
  }
}

function preloadPropsFromRawProps(rawBorrowedProps) {
  return Object.assign({}, rawBorrowedProps);
}

function stylePropsFromRawProps(rawProps) {
  const props = Object.assign({}, rawProps);
  props['data-rprec'] = rawProps.precedence;
  props.precedence = null;
  return props;
} // --------------------------------------
//      Resource Reconciliation
// --------------------------------------


export function acquireResource(resource) {
  switch (resource.type) {
    case 'style':
      {
        return acquireStyleResource(resource);
      }

    case 'preload':
      {
        return resource.instance;
      }

    default:
      {
        throw new Error(`acquireResource encountered a resource type it did not expect: "${resource.type}". this is a bug in React.`);
      }
  }
}
export function releaseResource(resource) {
  switch (resource.type) {
    case 'style':
      {
        resource.count--;
      }
  }
}

function createResourceInstance(type, props, ownerDocument) {
  const element = createElement(type, props, ownerDocument, HTML_NAMESPACE);
  setInitialProperties(element, type, props);
  return element;
}

function createStyleResource(styleResources, root, href, precedence, props) {
  if (__DEV__) {
    if (styleResources.has(href)) {
      console.error('createStyleResource was called when a style Resource matching the same href already exists. This is a bug in React.');
    }
  }

  const limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
  const existingEl = root.querySelector(`link[rel="stylesheet"][href="${limitedEscapedHref}"]`);
  const resource = {
    type: 'style',
    count: 0,
    href,
    precedence,
    props,
    hint: null,
    preloaded: false,
    loaded: false,
    error: false,
    root,
    instance: null
  };
  styleResources.set(href, resource);

  if (existingEl) {
    // If we have an existing element in the DOM we don't need to preload this resource nor can we
    // adopt props from any preload that might exist already for this resource. We do need to try
    // to reify the Resource loading state the best we can.
    const loadingState = existingEl._p;

    if (loadingState) {
      switch (loadingState.s) {
        case 'l':
          {
            resource.loaded = true;
            break;
          }

        case 'e':
          {
            resource.error = true;
            break;
          }

        default:
          {
            attachLoadListeners(existingEl, resource);
          }
      }
    } else {
      // This is unfortunately just an assumption. The rationale here is that stylesheets without
      // a loading state must have been flushed in the shell and would have blocked until loading
      // or error. we can't know afterwards which happened for all types of stylesheets (cross origin)
      // for instance) and the techniques for determining if a sheet has loaded that we do have still
      // fail if the sheet loaded zero rules. At the moment we are going to just opt to assume the
      // sheet is loaded if it was flushed in the shell
      resource.loaded = true;
    }
  } else {
    const hint = preloadResources.get(href);

    if (hint) {
      // $FlowFixMe[incompatible-type]: found when upgrading Flow
      resource.hint = hint; // If a preload for this style Resource already exists there are certain props we want to adopt
      // on the style Resource, primarily focussed on making sure the style network pathways utilize
      // the preload pathways. For instance if you have diffreent crossOrigin attributes for a preload
      // and a stylesheet the stylesheet will make a new request even if the preload had already loaded

      const preloadProps = hint.props;
      adoptPreloadProps(resource.props, hint.props);

      if (__DEV__) {
        resource._dev_preload_props = preloadProps;
      }
    }
  }

  return resource;
}

function adoptPreloadProps(styleProps, preloadProps) {
  if (styleProps.crossOrigin == null) styleProps.crossOrigin = preloadProps.crossOrigin;
  if (styleProps.referrerPolicy == null) styleProps.referrerPolicy = preloadProps.referrerPolicy;
  if (styleProps.media == null) styleProps.media = preloadProps.media;
  if (styleProps.title == null) styleProps.title = preloadProps.title;
}

function immediatelyPreloadStyleResource(resource) {
  // This function must be called synchronously after creating a styleResource otherwise it may
  // violate assumptions around the existence of a preload. The reason it is extracted out is we
  // don't always want to preload a style, in particular when we are going to synchronously insert
  // that style. We confirm the style resource has no preload already and then construct it. If
  // we wait and call this later it is possible a preload will already exist for this href
  if (resource.loaded === false && resource.hint === null) {
    const {
      href,
      props
    } = resource;
    const preloadProps = preloadPropsFromStyleProps(props);
    resource.hint = createPreloadResource(getDocumentFromRoot(resource.root), href, preloadProps);
  }
}

function preloadPropsFromStyleProps(props) {
  return {
    rel: 'preload',
    as: 'style',
    href: props.href,
    crossOrigin: props.crossOrigin,
    integrity: props.integrity,
    media: props.media,
    hrefLang: props.hrefLang,
    referrerPolicy: props.referrerPolicy
  };
}

function createPreloadResource(ownerDocument, href, props) {
  const limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
  let element = ownerDocument.querySelector(`link[rel="preload"][href="${limitedEscapedHref}"]`);

  if (!element) {
    element = createResourceInstance('link', props, ownerDocument);
    insertPreloadInstance(element, ownerDocument);
  }

  return {
    type: 'preload',
    href: href,
    ownerDocument,
    props,
    instance: element
  };
}

function acquireStyleResource(resource) {
  if (!resource.instance) {
    const {
      props,
      root,
      precedence
    } = resource;
    const limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(props.href);
    const existingEl = root.querySelector(`link[rel="stylesheet"][data-rprec][href="${limitedEscapedHref}"]`);

    if (existingEl) {
      resource.instance = existingEl;
      resource.preloaded = true;
      const loadingState = existingEl._p;

      if (loadingState) {
        // if an existingEl is found there should always be a loadingState because if
        // the resource was flushed in the head it should have already been found when
        // the resource was first created. Still defensively we gate this
        switch (loadingState.s) {
          case 'l':
            {
              resource.loaded = true;
              resource.error = false;
              break;
            }

          case 'e':
            {
              resource.error = true;
              break;
            }

          default:
            {
              attachLoadListeners(existingEl, resource);
            }
        }
      } else {
        resource.loaded = true;
      }
    } else {
      const instance = createResourceInstance('link', resource.props, getDocumentFromRoot(root));
      attachLoadListeners(instance, resource);
      insertStyleInstance(instance, precedence, root);
      resource.instance = instance;
    }
  }

  resource.count++; // $FlowFixMe[incompatible-return] found when upgrading Flow

  return resource.instance;
}

function attachLoadListeners(instance, resource) {
  const listeners = {};
  listeners.load = onResourceLoad.bind(null, instance, resource, listeners, loadAndErrorEventListenerOptions);
  listeners.error = onResourceError.bind(null, instance, resource, listeners, loadAndErrorEventListenerOptions);
  instance.addEventListener('load', listeners.load, loadAndErrorEventListenerOptions);
  instance.addEventListener('error', listeners.error, loadAndErrorEventListenerOptions);
}

const loadAndErrorEventListenerOptions = {
  passive: true
};

function onResourceLoad(instance, resource, listeners, listenerOptions) {
  resource.loaded = true;
  resource.error = false;

  for (const event in listeners) {
    instance.removeEventListener(event, listeners[event], listenerOptions);
  }
}

function onResourceError(instance, resource, listeners, listenerOptions) {
  resource.loaded = false;
  resource.error = true;

  for (const event in listeners) {
    instance.removeEventListener(event, listeners[event], listenerOptions);
  }
}

function insertStyleInstance(instance, precedence, root) {
  const nodes = root.querySelectorAll('link[rel="stylesheet"][data-rprec]');
  const last = nodes.length ? nodes[nodes.length - 1] : null;
  let prior = last;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodePrecedence = node.dataset.rprec;

    if (nodePrecedence === precedence) {
      prior = node;
    } else if (prior !== last) {
      break;
    }
  }

  if (prior) {
    // We get the prior from the document so we know it is in the tree.
    // We also know that links can't be the topmost Node so the parentNode
    // must exist.
    prior.parentNode.insertBefore(instance, prior.nextSibling);
  } else {
    const parent = root.nodeType === DOCUMENT_NODE ? root.head : root;

    if (parent) {
      parent.insertBefore(instance, parent.firstChild);
    } else {
      throw new Error('While attempting to insert a Resource, React expected the Document to contain' + ' a head element but it was not found.');
    }
  }
}

function insertPreloadInstance(instance, ownerDocument) {
  if (!ownerDocument.contains(instance)) {
    const parent = ownerDocument.head;

    if (parent) {
      parent.appendChild(instance);
    } else {
      throw new Error('While attempting to insert a Resource, React expected the Document to contain' + ' a head element but it was not found.');
    }
  }
}

export function isHostResourceType(type, props) {
  switch (type) {
    case 'link':
      {
        switch (props.rel) {
          case 'stylesheet':
            {
              if (__DEV__) {
                validateLinkPropsForStyleResource(props);
              }

              const {
                href,
                precedence,
                onLoad,
                onError,
                disabled
              } = props;
              return typeof href === 'string' && typeof precedence === 'string' && !onLoad && !onError && disabled == null;
            }

          case 'preload':
            {
              if (__DEV__) {
                validateLinkPropsForStyleResource(props);
              }

              const {
                href,
                as,
                onLoad,
                onError
              } = props;
              return !onLoad && !onError && typeof href === 'string' && isResourceAsType(as);
            }
        }
      }
  }

  return false;
}

function isResourceAsType(as) {
  return as === 'style' || as === 'font';
} // When passing user input into querySelector(All) the embedded string must not alter
// the semantics of the query. This escape function is safe to use when we know the
// provided value is going to be wrapped in double quotes as part of an attribute selector
// Do not use it anywhere else
// we escape double quotes and backslashes


const escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n\"\\]/g;

function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
  return value.replace(escapeSelectorAttributeValueInsideDoubleQuotesRegex, ch => '\\' + ch.charCodeAt(0).toString(16));
}