/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import { enableNewReconciler } from 'shared/ReactFeatureFlags';
import { getCurrentRootHostContainer as getCurrentRootHostContainer_old } from './ReactFiberHostContext.old';
import { getCurrentRootHostContainer as getCurrentRootHostContainer_new } from './ReactFiberHostContext.new';
export function getCurrentRootHostContainer() {
  return enableNewReconciler ? getCurrentRootHostContainer_new() : getCurrentRootHostContainer_old();
}