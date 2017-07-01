
function foo(x) {
  console.log('foo', x);
}

function callFooAsync(i, callback) {
  new Promise(function(resolve) {
    try {
      foo(i);
      resolve();
    }
    catch(err) {
      if (callback) {
        callback(err);
      }
    }
  }).then(callFooAsync.bind(this, i+1));
}


callFooAsync(0, function(err) {
  console.log(err);
});

console.log('stuff...');



