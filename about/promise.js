function sleep(time) {
  return new Promise((resolve) => {
      setTimeout(resolve, time);
  });
}

function doSome() {
  return sleep(2000).then(() => {
    console.log('no sleep')
    return 1
  })
}
async function  doRes () {
  const res = await doSome();
  console.log(res);
}
// doRes();
function add (a, b) {
  return a + b
}
function later () {
  setTimeout(() => {
    console.log('setTimeout')
  }, 3000)
}
Promise.resolve(later()).then(res => {
  console.log(res);
}) 
