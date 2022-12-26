import * as React from "react";
import { createRoot } from "react-dom/client";
class App extends React.Component {
  constructor(props) {
    super(props);
    this.parentRef = React.createRef(); //{current:null} this.parentRef.current=div的真实DOM
    this.childRef = React.createRef(); //this.childRef.current = p的真实DOM
  }
  //在组件渲染挂载后执行此函数
  componentDidMount() {
    this.parentRef.current.addEventListener(
      "click",
      () => {
        console.log("父原生捕获");
      },
      true
    );
    this.parentRef.current.addEventListener(
      "click",
      () => {
        console.log("父原生冒泡");
      },
      false
    );
    this.childRef.current.addEventListener(
      "click",
      () => {
        console.log("子原生捕获");
      },
      true
    );
    this.childRef.current.addEventListener(
      "click",
      () => {
        console.log("子原生冒泡");
      },
      false
    );
  }
  parentBubble = () => {
    console.log("父React冒泡");
  };
  parentCapture = () => {
    console.log("父React捕获");
  };
  childBubble = () => {
    console.log("子React冒泡");
  };
  childCapture = () => {
    console.log("子React捕获");
  };
  render() {
    return (
      <div ref={this.parentRef} id="container" onClick={this.parentBubble} onClickCapture={this.parentCapture}>
        <p ref={this.childRef} id="title" onClick={this.childBubble} onClickCapture={this.childCapture}>
          点击
        </p>
      </div>
    );
  }
}
let element = <App />;

const root = createRoot(document.getElementById("root"));
root.render(element);
