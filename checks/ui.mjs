export async function gameControl(page, name) {
  const control = page.getByRole("button", { name, exact: true });
  if (!(await control.isVisible())) {
    const menu = page.getByLabel("メニュー", { exact: true });
    if (await menu.count()) await menu.click();
  }
  return control;
}
