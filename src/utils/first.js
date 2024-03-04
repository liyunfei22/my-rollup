export default function first(candidates) {
  return function (...args) {
    return candidates.reduce((promise, candidate) => {
      return promise.then((result) =>
        result != null ? result : Promise.resolve(candidate(...args))
      );
    }, Promise.resolve());
  };
}
