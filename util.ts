export function trim(str: string, ch: string) {
    var start = 0,
        end = str.length;

    while(start < end && str[start] === ch)
        ++start;

    while(end > start && str[end - 1] === ch)
        --end;

    return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}


export function getLastUrlPart(url: string) {
    if (!url) return url;
    let parts = url.split('/');
    return parts[parts.length - 1];
}

export function removeUrlLastPart(url: string) {
    if (!url) return url;
    return url.substring(0, url.lastIndexOf('/'));
}
