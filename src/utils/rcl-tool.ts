


export function linksSourceMax(rcl: number) {

  switch (rcl) {
    case 5:
    case 6:
      return 2;
    case 7:
      return 4;
    case 8:
      return 6;

    default:
      return 0;

  }

}