
如果lastProps的style属性不存在，而nextProps的style属性存在，在这里会先向updatePayload中添加一个['style', null],在后面的setValueForStyles方法里会直接for循环这个null，
方法的最后还会根据styleUpdates是否有值来再添加一次['style',styleUpdates],最后更新对象里会出现二个重复的属性。所以我建议此处只需要把nextProp赋值给styleUpdates即可。




```js
var lastProps = {style:null}
var nextProps = {style:{color:'red'}}
```

If the `style` attribute of `lastProps` does not exist, but the `style` attribute of `nextProps` exists, a `['style ', null]` will be added to `updatePayload` here, and the later `setValueForStyles` method will directly loop for this `null`,

```js
export function setValueForStyles(node, styles) {
  const style = node.style;
  for (let styleName in styles) {
    if (!styles.hasOwnProperty(styleName)) {
      continue;
    }
}
```

At the end of the method, `['style ', styleUpdates]` will be added again according to whether `styleUpdates` has a value. Finally, two duplicate attributes will appear in the 
`styleUpdates` .

```js
updatePayload =  ['style', null, 'style', {color:"red"}]
```

So I suggest that we just assign `nextProp` to `styleUpdates` here only.

