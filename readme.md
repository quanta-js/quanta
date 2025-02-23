# QuantaJS

A compact, scalable, and developer-friendly **state management library** designed for any JavaScript environment. It includes a **reactivity system** that enables efficient and flexible data handling, making complex state management easy.


## 🚀 Features

✅ **Framework-Agnostic** – Works in any JavaScript environment  
✅ **Reactive State** – Simple yet powerful reactivity system  
✅ **Scalable** – Suitable for small to large applications  
✅ **Side Effects Handling** – Manage async actions with ease  
✅ **Intuitive API** – Easy to learn and use  


## 📦 Installation

```sh
npm install quantajs
```

## ⚡ Quick Start

```javascript
import { createStore } from "quantajs";

const counter = createStore({
  state: { count: 0 },
  actions: {
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
  },
});

console.log(counter.count); // 0
counter.increment();
console.log(counter.count); // 1

```


## 📜 License
This project is licensed under the MIT [License](/LICENCE) - see the LICENSE file for details.


## 💬 Contributing
We welcome contributions! Feel free to open issues, submit PRs, or suggest improvements.

## ⭐ Support
If you find this library useful, consider giving it a ⭐ star on [GitHub](https://github.com/quanta-js/quanta)!