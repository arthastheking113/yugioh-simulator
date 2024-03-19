function removeBackDrop() {
    return;
    let model = document.getElementsByClassName("modal-backdrop fade show")[0];
    model.remove();

    let body = document.getElementsByTagName("BODY")[0];
    body.removeAttribute('class');
    body.removeAttribute('style');
    let model2 = document.getElementsByClassName("modal-backdrop fade show")[0];
    if (model2 != undefined) {
        model2.remove();
    }

    let body2 = document.getElementsByTagName("BODY")[0];
    if (body2 != undefined) {
        body.removeAttribute('class');
        body.removeAttribute('style');
    }

}