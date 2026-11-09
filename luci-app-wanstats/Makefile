include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wanstats
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_MAINTAINER:=qjt0409
PKG_LICENSE:=MIT
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	CATEGORY:=Network
	SUBMENU:=Luci
	TITLE:=LuCI for WAN daily/monthly traffic history (Padavan rstats style)
	DEPENDS:=+luci-base
endef

define Package/$(PKG_NAME)/description
  Standalone WAN traffic history only (the wanstats half of
  luci-app-bandwidthd, packaged separately so it can be installed
  alongside the original luci-app-bandwidthd): Padavan rstats-style
  daily and monthly WAN totals, kept for 13 months on persistent
  storage, older data removed automatically.
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/wanstats
endef

define Build/Configure
endef

define Build/Compile
endef

# Install steps use INSTALL_BIN for executables on purpose: the git
# working copy is not required to carry executable bits.
define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./root/etc/config/wanstats $(1)/etc/config/wanstats

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/wanstats $(1)/etc/init.d/wanstats

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./root/usr/sbin/wanstatsd $(1)/usr/sbin/wanstatsd
	$(INSTALL_BIN) ./root/usr/sbin/wanstats-collect $(1)/usr/sbin/wanstats-collect

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/wanstats $(1)/usr/libexec/rpcd/wanstats

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-wanstats.json $(1)/usr/share/rpcd/acl.d/luci-app-wanstats.json

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-wanstats.json $(1)/usr/share/luci/menu.d/luci-app-wanstats.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/wanstats
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/wanstats/wanstats.js $(1)/www/luci-static/resources/view/wanstats/wanstats.js
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/wanstats/settings.js $(1)/www/luci-static/resources/view/wanstats/settings.js
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	/etc/init.d/wanstats enable 2>/dev/null
	/etc/init.d/wanstats restart 2>/dev/null
	/etc/init.d/rpcd restart 2>/dev/null
}
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
