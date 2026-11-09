include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-bandwidthd
PKG_VERSION:=2.1.1
PKG_RELEASE:=1
PKG_MAINTAINER:=qjt0409
PKG_LICENSE:=MIT
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	CATEGORY:=Network
	SUBMENU:=Luci
	TITLE:=LuCI for bandwidthd + Padavan-style WAN daily/monthly traffic history
	DEPENDS:=+bandwidthd
endef

define Package/$(PKG_NAME)/description
  LuCI app for bandwidthd (per-IP LAN traffic graphs), plus a
  Padavan rstats-style WAN traffic history: daily and monthly totals,
  kept for 13 months on persistent storage, older data removed
  automatically.
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
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-bandwidthd.json $(1)/usr/share/rpcd/acl.d/luci-app-bandwidthd.json

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-bandwidthd.json $(1)/usr/share/luci/menu.d/luci-app-bandwidthd.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/bandwidthd
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/bandwidthd/config.js $(1)/www/luci-static/resources/view/bandwidthd/config.js
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/bandwidthd/wanstats.js $(1)/www/luci-static/resources/view/bandwidthd/wanstats.js
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/bandwidthd/settings.js $(1)/www/luci-static/resources/view/bandwidthd/settings.js
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	# remove leftovers of the old Lua-based luci-app-bandwidthd 1-1
	# (its controller would shadow this app's menu entries)
	rm -f /usr/lib/lua/luci/controller/bandwidthd.lua \
		/usr/lib/lua/luci/model/cbi/bandwidthd.lua \
		/usr/lib/lua/luci/i18n/bandwidthd.zh-cn.lmo \
		/etc/init_bandwidthd.sh
	rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
	/etc/init.d/wanstats enable 2>/dev/null
	/etc/init.d/wanstats restart 2>/dev/null
	/etc/init.d/rpcd restart 2>/dev/null
}
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
